package com.openframe.kafka.model;

import lombok.Data;

@Data
public class UserEvent implements KafkaMessage {

    private String userId;
    private String userName;

}
