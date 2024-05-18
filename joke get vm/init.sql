CREATE DATABASE IF NOT EXISTS jokes_db;

USE jokes_db;

CREATE TABLE IF NOT EXISTS joke_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT NOT NULL,
    setup VARCHAR(255) NOT NULL,
    punchline VARCHAR(255) NOT NULL,
    FOREIGN KEY (type_id) REFERENCES joke_types(id)
);

# Insert dummy values
INSERT INTO joke_types (name) VALUES
('Pun'),
('One-Liner'),
('Knock-Knock');

INSERT INTO jokes (type_id, setup, punchline) VALUES
(1, 'Why don''t some couples go to the gym? Because some relationships don''t work out!', 'Because they''re not on the same wavelength!'),
(2, 'What do you call fake spaghetti?', 'An impasta!'),
(3, 'Knock, knock.', 'Whos there? Olive. Olive who? Olive you and I miss you!');

INSERT INTO jokes (type_id, setup, punchline) VALUES 
(1, 'I told my wife she was drawing her eyebrows too high. She looked surprised.', 'But she quickly realized that was just archaic thinking.'),
(2, 'Why did the scarecrow win an award?', 'Because he was outstanding in his field!');
