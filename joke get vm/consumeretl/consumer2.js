const express = require('express')
const app = express()
const amqp = require('amqplib') // Documentation here: https://www.npmjs.com/package/amqp

const APP_CONSUMER2_PORT = 4001
const RMQ_CONSUMER2_PORT = 4101
const QUEUE_NAME = 'MODERATED_JOKES'  // Set in compose to change queue name
const RMQ_USER_NAME = 'admin'
const RMQ_PASSWORD =  'admin'
//const RMQ_HOST = '20.108.32.75'  // Private IP of the vm hosting rabbitmq
//const RMQ_HOST = 'localhost'   // If accessing local mq container
//const RMQ_HOST = 'host.docker.internal'
//const RMQ_HOST = '172.210.44.36'  //moderate ip address
const RMQ_HOST = '10.0.0.6'  //moderate ip address
//const RMQ_HOST = '10.1.0.4'

var database = require('./database');

app.get("/", (req, res) => {
  res.send(`Consumer 2 is up`)
})

// No http endpoints. Only using server to support the backend consumer app
const server = app.listen(APP_CONSUMER2_PORT, () => console.log(`Listening on port ${APP_CONSUMER2_PORT}`))

// Function connects to a queue and registers a callback which will run continuously
// Each time a message lands on the queue, the callback is called. Could for example, 
// just move messages straight into a database
async function getMessages(channel, queue) {
  try {
    await channel.assertQueue(queue, { durable: true })  // Connect to a durable queue or create if not there

    // Create callback that will listen for queued message availability
    channel.consume(queue, async (message) => {
      if (message !== null) {
          const joke = JSON.parse(message.content.toString());
          console.log(joke);

          if (joke.jokeType == 0) {
            // Insert joke type into joke_types table
            const insertJokeTypeQuery = 'INSERT INTO joke_types (name) VALUES (?)';
            const insertJokeTypeParams = [joke.jokeTypeName];
            database.query(insertJokeTypeQuery, insertJokeTypeParams, (err, result) => {
                if (err) {
                    console.error('Error inserting joke type into database:', err);
                } else {
                    console.log('Joke type inserted into database');
                    // Retrieve the inserted type_id
                    getTypeID(joke.jokeTypeName, (typeId) => {
                        // Insert joke into the database
                        insertJoke(typeId, joke.setup, joke.punchline);
                    });
                }
            });
          } else {
            // Insert joke directly into the database
            insertJoke(joke.jokeType, joke.setup, joke.punchline);
          }

          channel.ack(message);
      }
  });
  } catch (err) {
    throw err
  }
}

function getTypeID(jokeTypename, callback) {
    const getTypeIDQuery = 'SELECT id FROM joke_types WHERE name = ?';
    const getTypeIDParams = [jokeTypename];
    database.query(getTypeIDQuery, getTypeIDParams, (err, result) => {
        if (err) {
            console.error('Error getting type ID from database:', err);
        } else {
            if (result.length > 0) {
                callback(result[0].id); // Pass the type_id to the callback function
            } else {
                console.error('No matching type ID found in database');
            }
        }
    });
}

function insertJoke(typeId, setup, punchline) {
    // Insert joke into the database
    const insertQuery = 'INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)';
    const insertParams = [typeId, setup, punchline];
    database.query(insertQuery, insertParams, (err, result) => {
        if (err) {
            console.error('Error inserting joke into database:', err);
        } else {
            console.log('Joke inserted into database');
        }
    });
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

 // const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_CONSUMER2_PORT}/`
 // Alternatively, create connection with an object to provide settings other than default

 const conStr = {
  hostname: RMQ_HOST,
  port: RMQ_CONSUMER2_PORT,
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
    console.log(`Channel opened on Consumer2`)
    getMessages(channel, QUEUE_NAME) // Call to start the consumer callback
  }
  catch (err) {
    console.log(`General error: ${err}`)
    throw err
  }
})().catch((err) => { 
  console.log(`Shutting down node server listening on port ${APP_CONSUMER2_PORT}`)
  server.close() // Close the http server created with app.listen
  console.log(`Closing app with process.exit(1)`)
  process.exit(1)  // Exit process with an error to force the container to stop
}) // () means call it now

