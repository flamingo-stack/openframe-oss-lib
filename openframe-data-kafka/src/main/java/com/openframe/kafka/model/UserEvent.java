package com.openframe.kafka.model;

import lombok.Data;

@Data
public class UserEvent implements CommonMessage {

    private String userId;
    private String userName;

}
