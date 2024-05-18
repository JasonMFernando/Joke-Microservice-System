const mysql = require('mysql');

// Create MySQL connection
var connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'password', // Update with your MySQL password
    database: 'jokes_db'
  });

connection.connect(function(error)
{
	if(error)
	{
		throw error;
	}
	else
	{
		console.log('MySQL Database is connected Successfully')
	}
});

module.exports = connection;