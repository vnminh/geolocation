CREATE DATABASE IF NOT EXISTS geotagging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE geotagging;

CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS db_upsert_req (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  image_url TEXT NOT NULL,
  cot TEXT NULL,
  lat DOUBLE NOT NULL,
  lon DOUBLE NOT NULL,
  status ENUM('decline', 'reviewing', 'accepted') NOT NULL DEFAULT 'reviewing',
  accepted_by INT NULL,
  CONSTRAINT fk_db_upsert_req_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_db_upsert_req_accepted_by FOREIGN KEY (accepted_by) REFERENCES user(id)
);
