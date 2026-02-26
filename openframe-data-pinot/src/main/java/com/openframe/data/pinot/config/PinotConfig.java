package com.openframe.data.pinot.config;

import org.apache.pinot.client.Connection;
import org.apache.pinot.client.ConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Properties;

@Configuration
public class PinotConfig {

    @Value("${pinot.broker.url}")
    private String brokerUrl;

    @Value("${pinot.controller.url}")
    private String controllerUrl;

    @Bean
    public Connection pinotBrokerConnection() {
        Properties properties = new Properties();
        properties.setProperty("brokerList", brokerUrl);
        return ConnectionFactory.fromProperties(properties);
    }

    @Bean
    public Connection pinotControllerConnection() {
        return ConnectionFactory.fromHostList(controllerUrl);
    }
}
