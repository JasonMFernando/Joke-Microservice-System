// RabbitMQ demo. Does nothing fancy - uses defaults. Queue is not set to be durable after container restart
const express = require('express')
const app = express()
const amqp = require("amqplib") // Documentation here: https://www.npmjs.com/package/amqp
const fs = require('fs').promises;
const path = require('path');
app.use(express.json()) // Enable json POST

const APP_PRODUCER_PORT = 3005
const RMQ_PRODUCER_PORT = 5672
const RMQ_USER_NAME = 'admin'
const RMQ_PASSWORD = 'admin'
//const RMQ_HOST = '20.90.112.187' // If mq is running in cloud but attaching from local vscode
const RMQ_HOST = 'rabbitmq'    // Docker DNS for mq if conecting from a container whether local or not
//const RMQ_HOST = 'localhost'   // Connect to local container from vscode
//const RMQ_HOST = host.docker.internal
let gConnection  // File scope so functions can use them
let gChannel

app.get("/", (req, res) => {
  res.send(`Producer is up`)
})


// Generate some random messages for the queue. Call with:
// localhost:3004/rand to generate one tv type
// localhost:3004/rand?cat=computer&num=5 to generate 5 computer type messages
app.get("/rand", async (req, res) => {
  let category = req.query.cat ? req.query.cat : 'tv'
  let numMsgs = req.query.num ? req.query.num : 1

  try {
    await sendRandMsg(gChannel, category, numMsgs)
    res.status(202).send(`${numMsgs} queued`)       // 202 = accepted. i.e. added to a queue but not necessarily processed yet
  } catch (err) {
    res.status(500).send(err) // Server error
  }
})

// This will output a random mixture of the topics
// localhost:3004/mix?num=5 to generate 5 mixed computer and tv type messages
app.get("/mix", async (req, res) => {
  let numMsgs = req.query.num ? req.query.num : 1
  for (i = 0; i < numMsgs; i++) {
    try {
      await sendRandMsg(gChannel, 'mix', numMsgs)
    } catch (err) {
      res.status(500).send(err) // Server error
    }
  }
  res.status(202).send(`${numMsgs} queued`)       // 202 = accepted. i.e. added to a queue but not necessarily processed yet
})


// Post a single message to the appropriate queue based on 
app.post("/msg", async (req, res) => {
  try {
    await sendMsg(gChannel, req.body)
    res.sendStatus(202)
  } catch (err) {
    res.status(500).send(err)
  }
})

app.post('/moderate-joke-queue', async (req, res) => {
  try {
      // Extract data from the request body
      // const { queueName, jokeType, setup, punchline } = req.body;
      // const jokeTypeName = req.body.jokeTypeName;
      //"jokeType": jokeType, "setup": setup, "jokeTypeName": jokeTypeName, "punchline": punchline, "queueName": 'MODERATED_JOKES'
      const {  jokeType, setup, jokeTypeName,  punchline , queueName} = req.body;

      console.log(req.body);
      console.log('joketype',jokeType);
      console.log('setup ' ,setup);
      console.log('punchline ',punchline);
      console.log('joketype ',jokeTypeName);

      // Construct the joke object
      const jokeData = {
          jokeType,
          setup,
          punchline,
          jokeTypeName
      };

      //async function sendtojokequeue(channel, categ , jokeData) {
      console.log("came here mod");
      console.log(req.body);
      sendtojokequeue(gChannel , queueName , jokeData);

      
      // Send the joke data to the specified RabbitMQ queue
      //await gChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(jokeData)), { persistent: true });
      console.log(`Joke submitted to RabbitMQ queue "${queueName}"`);

      res.status(200).send(`Joke submitted to RabbitMQ queue "${queueName}"`);
  } catch (error) {
      console.error('Error submitting joke to RabbitMQ:', error);
      res.status(500).send('Error submitting joke to RabbitMQ');
  }
});

app.post('/save-types', async (req, res) => {
  try {
    //const { jokeTypes } = req.body; // Assuming jokeTypes is in JSON format like { "jokeTypes": ["type1", "type2", ...] }
    const { jokeTypes } = req.body; // Access jokeTypes from req.body.postData
    console.log("jokeTypes" , jokeTypes);
    //const parsedJokeTypes = JSON.parse(jokeTypes); // Parse JSON string to extract the array of joke types
    //console.log("parsedJokeTypes " , parsedJokeTypes);
    await saveJokeTypes(jokeTypes);
    res.status(200).send('Joke types saved successfully.');
  } catch (error) {
    console.error('Error saving joke types:', error);
    res.status(500).send('Error saving joke types.');
  }
});


// Endpoint to get joke types
app.get('/getjoketypes', async (req, res) => {
  try {
    // Read joke types from the file in the Docker volume
    const filePath = '/var/lib/rabbitmq/joke_types.json'; // Path to the file in the Docker volume
    const jokeTypesData = await fs.readFile(filePath, 'utf-8');
    const jokeTypes = JSON.parse(jokeTypesData);
    
    // Send joke types as JSON response
    res.json(jokeTypes);
  } catch (error) {
    console.error('Error retrieving joke types:', error);
    res.status(500).json({ error: 'Failed to retrieve joke types' });
  }
});




// app.listen returns an http server. Use this if we need to access the server - e.g. stop it
const server = app.listen(APP_PRODUCER_PORT, console.log(`Listening on port ${APP_PRODUCER_PORT}`))

/********************** Functions *************************************/

async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr)    // Create connection
    console.log(`Connected to rabbitmq using ${conStr}`)

    const channel = await connection.createChannel()    // Create channel. Channel can have multiple queues
    console.log(`Channel created`)

    return { connection, channel }

  } catch (err) {
    console.log(`Failed to connect to queue in createConection function`)
    throw err
  }
}

async function saveJokeTypes(jokeTypes) {
  try {
    const dirPath = '/var/lib/rabbitmq/';
    await fs.mkdir(dirPath, { recursive: true }); // Create directory recursively if it doesn't exist
    
    // Construct the path to the file
    const filePath = path.join(dirPath, 'joke_types.json');
    
    // Construct the data to be saved to the Docker volume
    const data = JSON.stringify(jokeTypes, null, 2);

    // Write the data to the Docker volume file
    await fs.writeFile(filePath, data);
    console.log('Joke types saved to Docker volume.');
  } catch (error) {
    console.error('Error saving joke types to Docker volume:', error);
    throw error;
  }
}

// If needed, this is a function to close the queue connections
async function closeConnection(connection, channel) {
  try {
    await channel.close()
    await connection.close()
    console.log(`Connection and channel closed`)
  } catch (err) {
    console.log(`Failed to close connection. ${err}`)
  }
}

// Queue one or more messages on the category queue
// Each message is randomly geerated by the createMessage function then queued
async function sendRandMsg(channel, categ, numMsgs) {
  const cat = ['tv', 'computer']
  for (i = 0; i < numMsgs; i++) {
    if (categ == 'mix') {
      category = cat[getRand(0, cat.length - 1)]
    } else {
      category = categ
    }

    try {
      const res = await channel.assertQueue(category, {durable: true})    // Create queue called whatever is in category if one doesn't exist
      console.log(`${category} queue created`)

      let msg = createMessage(category)
      await channel.sendToQueue(category, Buffer.from(JSON.stringify(msg)))
      console.log(msg)
    } catch (err) {
      console.log(`Failed to write to ${category} queue. ${err}`)
      throw err
    }
  }
}


async function sendtojokequeue(channel, categ , jokeData) {
  category = categ
  console.log(JSON.stringify(jokeData));

  try {
    const res = await channel.assertQueue(category, {durable: true})    // Create queue called whatever is in category if one doesn't exist
    console.log(`${category} queue created`)

    await gChannel.sendToQueue(category, Buffer.from(JSON.stringify(jokeData)), { persistent: true });
    //await channel.sendToQueue(category, Buffer.from(JSON.stringify(msg)))
  } catch (err) {
    console.log(`Failed to write to ${category} queue. ${err}`)
    throw err
  }
  }

// This function writes one json message to the queue based on the msg.category property
async function sendMsg(channel, msg) {
  try {
    const res = await channel.assertQueue(msg.category, {durable: true})    // Create queue called whatever is in category if one doesn't exist
    console.log(`${msg.category} queue created / accessed`)
    await channel.sendToQueue(msg.category, Buffer.from(JSON.stringify(msg)), { persistent: true }) // Saves to volume to survive broker restart
    console.log(msg)
  } catch (err) {
    console.log(`Failed to write to ${category} queue.${err}`)
  }
}


// Create a realistic looking message of the specified type based on random selections from arrays of text
// Only currently supports two types: computer and tv
function createMessage(type) {
  const compManufacturer = ['Dell', 'HP', 'Acer', 'Asus', 'Samsung', 'Toshiba']
  const compDevice = ['Laptop', 'desktop', 'Monitor', 'Keyboard']
  const tvManufacturer = ['Samsung', 'Hitachi', 'Toshiba', 'Philips', 'LG']
  const tvType = ['CRT', 'LCD', 'LED', 'QLED']

  const msg = {}
  switch (type) {
    case 'computer':
      msg.make = compManufacturer[getRand(0, compManufacturer.length - 1)]
      msg.device = compDevice[getRand(0, compDevice.length - 1)]
      msg.cost = getRand(10, 3004)
      break

    case 'tv':
      msg.make = tvManufacturer[getRand(0, tvManufacturer.length - 1)]
      msg.type = tvType[getRand(0, tvType.length - 1)]
      msg.cost = getRand(250, 5000)
      break
  }

  msg.cat = type
  return msg
}

// Get a random number between lower and upper inclusive
function getRand(lower, upper) {
  lower = Math.ceil(lower)
  upper = Math.floor(upper)
  return Math.floor(Math.random() * (upper - lower + 1)) + lower
}

// To use await on createConnection, it needs to be called from within an async function
// Created an Immediately-Invoked Function Expression (IIFE) function to do this
// This is a function that is immediately invoked after declaration
// syntax is:
// ( function() {
// })()
(async () => {
  const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_PRODUCER_PORT}/`
  try {
    console.log(`Trying to connect to RabbitMQ at ${RMQ_HOST}:${RMQ_PRODUCER_PORT}`) // Only give this level of detail away in testing
    const rmq = await createConnection(conStr) // amqplib is promise based so need to initialise it in a function as await only works in an async function
    gConnection = rmq.connection  // Globally available in the file for other functions to use if needed
    gChannel = rmq.channel
  }
  catch (err) {
    console.log(err.message)
    if (gConnection) {
      closeConnection(gConnection, gChannel)
      console.log(`Closing connections`)
    }
    throw err  // kill the app
  }
})().catch((err) => { 
  console.log(`Shutting down node server listening on port ${APP_PRODUCER_PORT}`)
  server.close()   // Close the http server created with app.listen
  process.exit(1)  // A non-zero exit will cause the container to stop - depending on restart policy, it docker may try to restart it
}) // () means call it now


