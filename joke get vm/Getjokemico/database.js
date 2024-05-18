const mysql = require('mysql');

//Create MYSQL Connection
 var connection = mysql.createConnection({
     host: 'mysql-db2',
     user: 'root',
     password: 'password', // Update with your MySQL password
     database: 'jokes_db'
   });

//comment this and uncomment when building in docker
//  var connection = mysql.createConnection({
//    host: '172.17.0.1',
//    user: 'root',
//    password: 'password', // Update with your MySQL password
//    database: 'jokes_db',
//    port: 3307
//  });

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