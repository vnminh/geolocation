CREATE DATABASE IF NOT EXISTS geotagging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE geotagging;

CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'block') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prediction (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  image_url TEXT NOT NULL,
  cot TEXT NULL,
  lat DOUBLE NOT NULL,
  lon DOUBLE NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prediction_user FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS db_upsert_req (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prediction_id INT NOT NULL UNIQUE,
  status ENUM('decline', 'reviewing', 'accepted') NOT NULL DEFAULT 'reviewing',
  accepted_by INT NULL,
  updated_lat DOUBLE NOT NULL,
  updated_lon DOUBLE NOT NULL,
  location TEXT NULL,
  updated_cot TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_db_upsert_req_prediction FOREIGN KEY (prediction_id) REFERENCES prediction(id),
  CONSTRAINT fk_db_upsert_req_accepted_by FOREIGN KEY (accepted_by) REFERENCES user(id)
);
