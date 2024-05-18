const express = require('express')
const app = express()
const axios = require('axios')
const path = require('path')
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');

const SubmitPort = 4200
const GetJokePort = 3000
//const RabbitPort = 3004
const RabbitPort = 4203
const GetSubmitHost =  'localhost'  
//const GetJokeHost =  'host.docker.internal' //when running in docker
//const GetJokeHost =  'localhost' //when running in local
//const GetJokeHost =  '20.163.179.127' //public azure public ip address here
const GetJokeHost =  '10.0.0.4'
//const GetRabbitHost = 'localhost'
//const GetRabbitHost = 'host.docker.internal'
//const GetRabbitHost = '4.227.150.72'
const GetRabbitHost = '10.0.0.5'

//var database = require('./database');

app.use(express.static(__dirname))
app.use(express.json());


//Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Joke Service API',
      version: '1.0.0',
      description: 'API documentation for Joke Service',
    },
    servers: [
      {
        url: `http://4.227.150.72:3200`,
        description: 'Joke Service (Get)',
      },
      {
        url: `http://10.0.0.5:3200`,
        description: 'Joke Service (Get)',
      },
      {
        url: `http://localhost:${GetJokePort}`,
        description: 'Joke Service (Get)',
      },
      {
        url: `http://localhost:${SubmitPort}`,
        description: 'Local server',
      },
      {
        url: `http://localhost:${RabbitPort}`,
        description: 'Joke Submit (Post)',
      },
      {
        url: `http://localhost:3200`,
        description: 'Local server',
      },
    ],
  },
  apis: ['app.js'], // Replace 'app.js' with the filename where your routes are defined
};


		
// Initialize Swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);
// Serve Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
//app.use('/docs', cors(), swaggerUi.serve, swaggerUi.setup(swaggerSpec));

	
/**
 * @swagger
 * /joketypes:
 *   get:
 *     summary: Get joke types
 *     description: Retrieve a list of joke types.
 *     responses:
 *       200:
 *         description: A list of joke types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *     tags:
 *       - Jokes
 */



// Deny access to public caller 
app.get('/want-yang', (req, res) => {
  if (req.headers.host == `${GetJokeHost}:${SubmitPort}`)
    res.send(`<h2>Hey Yin, I'll be your Yang. <br>Here is my address: ${req.headers.host} (${req.socket.localAddress}). <br>I know yours is yours is: ${req.socket.remoteAddress}</h2>`)
  else
    res.send(`<h2>Hey Yang, this is Yin and Yang not Yang and Yang - what's the matter with you..?</h2>`)
})


/**
 * @swagger
 * /submit-joke:
 *   post:
 *     summary: Submit a joke
 *     description: Submit a joke to the queue.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jokeType:
 *                 type: string
 *               setup:
 *                 type: string
 *               punchline:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joke submitted successfully
 *       500:
 *         description: Failed to submit joke
 *     tags:
 *       - Jokes
 */

app.get('/want-yin', async (req, res) => {
  try {
    const response = await axios.get(`http://${GetSubmitHost}:${GetJokePort}/want-yin`)
    res.send(response.data)
  } catch (err) {
    res.send(err)
  }
})


app.get('/joketypes', async(req, res, next) => {

  try {
    const response = await axios.get(`http://${GetJokeHost}:${GetJokePort}/types`);
//    const response = await axios.get(`http://${GetJokeHost}:3000/types`);
    const jokeTypes = response.data;
    console.log(jokeTypes);

    // Send a request to save joke types to Docker volume
    //await axios.post(`http://${GetRabbitHost}:${RabbitPort}/save-types`, {jokeTypes} );
    try {
      await axios.post(`http://${GetRabbitHost}:${RabbitPort}/save-types`, {jokeTypes});
    } catch (error) {
      console.error('Failed to save joke types to Docker volume:', error);
      // Log the error and continue without saving the joke types
    }

    
    res.json(jokeTypes)
  } catch (err) {
    
    try {
      // Attempt to retrieve joke types from the Docker volume
      const response = await axios.get(`http://${GetRabbitHost}:${RabbitPort}/getjoketypes`);
      const jokeTypes = response.data;
      res.json(jokeTypes);
    } catch (error) {
      console.error('Failed to retrieve joke types from Docker volume:', error);
      res.status(500).send('Failed to retrieve joke types from Docker volume');
    }


    //res.send(err)
  }
    // database.query('SELECT * FROM joke_types', function(error, data){
    //     if (error) {
    //         // Handle error
    //         console.error('Error:', error);
    //         res.status(500).json({ error: 'Internal Server Error' });
    //         return;
    //     }
    //     res.json(data);
    // });      
});


app.get('/getJokesByType', (req, res) => {
    const type_id = req.query.type_id; // Assuming type_id is passed as a query parameter
  
    //const sql = `SELECT setup FROM jokes WHERE type_id = ?`;
    const sql = `SELECT setup, punchline FROM jokes WHERE type_id = ? ORDER BY RAND() LIMIT 1`;
    console.log(sql + " wrote");
    database.query(sql, [type_id], (error, results) => {
      if (error) {
        res.status(500).json({ error: 'An error occurred' });
      } else {
        res.json(results);
      }
    });
  });


  app.get('/getRandomJoke', (req, res) => {
    const sql = `SELECT setup, punchline FROM jokes ORDER BY RAND() LIMIT 1`;
    database.query(sql, (error, results) => {
        if (error) {
            res.status(500).json({ error: 'An error occurred' });
        } else {
            res.json(results);
        }
    });
  });

// Define a POST route for submitting jokes to the queue
app.post('/submit-joke', async (req, res) => {
  try {
    const { jokeType, setup, punchline } = req.body;

    console.log(jokeType);
    console.log(setup);
    console.log(punchline);

    // Send the joke data to the RabbitMQ queue
    const response = await axios.post(`http://${GetRabbitHost}:${RabbitPort}/submit-joke-queue`, { jokeType, setup, punchline, queueName: 'SUBMITTED_JOKES' });
    
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





app.listen(SubmitPort, () => console.log(`Listening on port ${SubmitPort}`))



