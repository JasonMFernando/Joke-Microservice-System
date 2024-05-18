const express = require('express')
const app = express()
const amqp = require('amqplib') // Documentation here: https://www.npmjs.com/package/amqp
const axios = require('axios')
const fs = require('fs').promises;
const path = require('path');

const APP_CONSUMER1_PORT = 4100
const RMQ_CONSUMER1_PORT = 4201
//const RMQ_CONSUMER1_PORT = 5672 //change
//const GetJokePort = 4000;
const GetJokePort = 3000; //access docker in local machine
//const GetJokeHost = 'localhost'
//const GetJokeHost = 'host.docker.internal'
//const GetJokeHost =  '20.163.179.127' //public azure public ip address here joke ip address
const GetJokeHost =  '10.0.0.4'
//const GetRabbitHost = 'localhost' //when running locally
//const GetRabbitHost = 'host.docker.internal' //when running docker to docker on local machine
//const GetRabbitHost = '172.210.44.36'  //moderate ip address
const GetRabbitHost = '10.0.0.6'
const RabbitPort = 4103
const QUEUE_NAME = process.env.QUEUE_NAME || 'SUBMITTED_JOKES'  // Set in compose to change queue name
const RMQ_USER_NAME = 'admin'
const RMQ_PASSWORD =  'admin'
//const RMQ_HOST = '10.1.0.4'  // Private IP of the vm hosting rabbitmq
//const RMQ_HOST = 'localhost'   // If accessing local mq container
//const RMQ_HOST = 'rabbitmq'  //container to container communication
//const RMQ_HOST = '4.227.150.72'
const RMQ_HOST = '10.0.0.5'
//const RMQ_HOST = '20.108.32.75' //submit vm ip address

let currentJokeIndex = 0;
let messages = [];


app.use(express.static(__dirname))
app.use(express.json());


app.get("/", (req, res) => {
  res.send(`Consumer 1 is up`)
})

app.get("/fetch-messages", async (req, res) => {
  try {
    const messages = await consumeMessages();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


app.get('/types', async (req, res) => {
  try {
    const response = await axios.get(`http://${GetJokeHost}:${GetJokePort}/types`);

    if (response.status === 200) {
      // If the response is successful, send the joke types to the client
      const jokeTypes = response.data;

      try {
        await axios.post(`http://${GetRabbitHost}:${RabbitPort}/save-types`, {jokeTypes});
      } catch (error) {
        console.error('Failed to save joke types to Docker volume:', error);
        // Log the error and continue without saving the joke types
      }

      res.status(200).json(response.data);
    } else {
      // If the response is not successful, send an error message
      throw new Error('Failed to get joke types');
    }
  } catch (error) {

    try {
      // Attempt to retrieve joke types from the Docker volume
      const response = await axios.get(`http://${GetRabbitHost}:${RabbitPort}/getjoketypes`);
      const jokeTypes = response.data;

      res.json(jokeTypes);
    } catch (error) {
      console.error('Failed to retrieve joke types from Docker volume:', error);
      res.status(500).send('Failed to retrieve joke types from Docker volume');
    }


    // If an error occurs, log the error and send an error response
    console.error('Error:', error);
    //res.status(500).json({ error: 'Failed to get joke types' });
  }
});


app.get('/current-joke', async (req, res) => {
  try {
    setTimeout(async () => {
      const message = await channel.get(QUEUE_NAME);
      if (!message) {
          // If there are no messages in the queue, send an appropriate response
          res.status(404).json({ message: 'No jokes available' });
      } else {
          // If a message is available, parse it and send it as the current joke
          const currentJoke = JSON.parse(message.content.toString());
          console.log("current joke " , currentJoke);
          channel.ack(message);
          res.status(200).json(currentJoke);
      }
    }, 2000); // Delay of 2000 milliseconds (2 seconds)
  } catch (error) {
      // If an error occurs, send an error response
      console.error('Error getting current joke:', error);
      res.status(500).json({ error: 'Failed to get current joke' });
  }
});



// Endpoint to delete the current joke
app.post('/delete-joke', (req, res) => {
  // Handle deleting joke here
  // Reset the currentJokeIndex to reset the joke to the beginning of the queue
  currentJokeIndex = 0;
  res.status(200).json({ message: 'Joke deleted successfully' });
});

// Define a POST route for submitting jokes to the queue
app.post('/submit-joke', async (req, res) => {
  try {
    const { jokeType, setup, punchline , jokeTypeName } = req.body;
    //const jokeTypeName = req.body.jokeTypeName;

    // console.log(jokeType);
    // console.log(setup);
    // console.log(punchline);
    // console.log(jokeTypeName);

    console.log('jokeType:', jokeType);
    console.log('jokeTypeName:', jokeTypeName);
    console.log('setup:', setup);
    console.log('punchline:', punchline);


    console.log({  "jokeType": jokeType, "setup": setup, "jokeTypeName": jokeTypeName, "punchline": punchline, "queueName": 'MODERATED_JOKES'});
    // Send the joke data to the RabbitMQ queue
    //const response = await axios.post(`http://${GetRabbitHost}:${RabbitPort}/moderate-joke-queue`, { jokeType, setup, jokeTypeName ,punchline , queueName: 'MODERATED_JOKES' });
    // const response = await axios.post(`http://${GetRabbitHost}:${RabbitPort}/moderate-joke-queue`, { jokeType, setup, jokeTypeName, punchline, queueName: 'MODERATED_JOKES' });
    const response = await axios.post(`http://${GetRabbitHost}:${RabbitPort}/moderate-joke-queue`, {  "jokeType": jokeType, "setup": setup, "jokeTypeName": jokeTypeName, "punchline": punchline, "queueName": 'MODERATED_JOKES' });
    // If the response is successful, send a success message
    if (response.status === 200) {
      res.status(200).json({ message: 'Joke submitted to the queue successfully' });
    } else {
      // If the response is not successful, send an error message
      throw new Error('Failed to submit joke to the queue');
    }
  } catch (error) {
    // If an error occurs, log the error and send an error response
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to submit joke to the queue' });
  }
});



// No http endpoints used. Only using server to support the backend consumer app
const server = app.listen(APP_CONSUMER1_PORT, () => console.log(`Listening on port ${APP_CONSUMER1_PORT}`))


// ********* Functions *****************


async function consumeMessages() {
  try {
    const connection = await amqp.connect(`amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_CONSUMER1_PORT}`);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    const messages = [];
    //while (true) {
      const message = await channel.get(QUEUE_NAME);
      //channel.ack(message);
      //if (!message) break;
      messages.push(message.content.toString());
    //}

    await channel.close();
    await connection.close();
    return messages;
  } catch (error) {
    throw error;
  }
}



// Create connection and channel and return them to the caller
async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr)    // Create connection
    console.log(`Connected to Rabbitmq cluster`)

    const channel = await connection.createChannel()    // Create channel. Channel can have multiple queues
    console.log(`Channel created. Will connect to queue: ${QUEUE_NAME}`)

    return { connection, channel }

  } catch (err) {
    console.log(`Failed to connect to RabbitMQ`)
    throw err
  }
}



// This is a very simple consumer for the tv queue. Run it once and it will consume any messages in the queue
// You need to acknowledge receipt for it to be deleted
// Demo shows how you can look for specific queue and even specific messages - other apps may be looking for others
(async () => {

 // const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_CONSUMER1_PORT}/`
 // Alternatively, create connection with an object to provide settings other than default

 const conStr = {
  hostname: RMQ_HOST,
  port: RMQ_CONSUMER1_PORT,
  username: RMQ_USER_NAME,
  password: RMQ_PASSWORD,
  vhost: '/',
  reconnect: true, // Enable automatic reconnection
  reconnectBackoffStrategy: 'linear', // or 'exponential'
}

  try {
    const rmq = await createConnection(conStr) // amqplib is promise based so need to initialise it in a function as await only works in an async function
    console.log(`Connection created using: ${conStr}`)
    connection = rmq.connection  // Available if needed for something
    channel = rmq.channel
    console.log(`Channel opened on Consumer1`)

    //getMessages(channel, QUEUE_NAME) // Call to start the consumer callback
  }
  catch (err) {
    console.log(`General error: ${err}`)
    throw err
  }
})().catch((err) => { 
  console.log(`Shutting down node server listening on port ${APP_CONSUMER1_PORT}`)
  //server.close() // Close the http server created with app.listen
  console.log(`Closing app with process.exit(1)`)
  process.exit(1)  // Exit process with an error to force the container to stop
}) // () means call it now

