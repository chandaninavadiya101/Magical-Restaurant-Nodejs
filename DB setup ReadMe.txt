To connect postgres DB execute steps:

1)psql -U postgres

2)CREATE USER "MRuser" WITH PASSWORD 'test@1';
3)CREATE DATABASE "MagicalRestDB";
4)GRANT ALL PRIVILEGES ON DATABASE "MagicalRestDB" TO "MRuser";

5)\c MagicalRestDB

6)CREATE TABLE dishes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL
);

7)CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL
);

8)CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  uid INT REFERENCES users (id),
  did INT REFERENCES dishes (id),
  rating NUMERIC(3, 1) CHECK (rating >= 0 AND rating <= 5)
);
