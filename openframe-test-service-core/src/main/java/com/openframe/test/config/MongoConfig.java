package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class MongoConfig {

    private static String mongoUri;
    private static String dbName;
    private static String mongoUser;
    private static String mongoPassword;
    private static String authDatabase;

    public static String getMongoDbUri() {
        if (mongoUri == null) {
            String envVar = System.getenv("MONGODB_URI");
            if (envVar != null && !envVar.trim().isEmpty()) {
                mongoUri = envVar;
            } else {
                throw new RuntimeException("MONGODB_URI environment variable is not set");
            }
            log.debug("MONGODB_URI: {}", mongoUri);
        }
        return mongoUri;
    }

    public static String getDatabaseName() {
        if (dbName == null) {
            String envVar = System.getenv("MONGODB_DATABASE");
            if (envVar != null && !envVar.trim().isEmpty()) {
                dbName = envVar;
            } else {
                throw new RuntimeException("MONGODB_DATABASE environment variable is not set");
            }
            log.debug("MONGODB_DATABASE: {}", dbName);
        }
        return dbName;
    }

    public static String getMongoUser() {
        if (mongoUser == null) {
            String envVar = System.getenv("MONGODB_USERNAME");
            if (envVar != null && !envVar.trim().isEmpty()) {
                mongoUser = envVar;
            } else {
                throw new RuntimeException("MONGODB_USERNAME environment variable is not set");
            }
            log.debug("MONGODB_USERNAME: {}", mongoUser);
        }
        return mongoUser;
    }

    public static String getMongoPassword() {
        if (mongoPassword == null) {
            String envVar = System.getenv("MONGODB_PASSWORD");
            if (envVar != null && !envVar.trim().isEmpty()) {
                mongoPassword = envVar;
            } else {
                throw new RuntimeException("MONGODB_PASSWORD environment variable is not set");
            }
            log.debug("MONGODB_PASSWORD: {}", mongoPassword);
        }
        return mongoPassword;
    }

    public static String getAuthDatabase() {
        if (authDatabase == null) {
            String envVar = System.getenv("MONGODB_AUTH_DATABASE");
            if (envVar != null && !envVar.trim().isEmpty()) {
                authDatabase = envVar;
            } else {
                throw new RuntimeException("MONGODB_AUTH_DATABASE environment variable is not set");
            }
            log.debug("MONGODB_AUTH_DATABASE: {}", authDatabase);
        }
        return authDatabase;
    }
}
