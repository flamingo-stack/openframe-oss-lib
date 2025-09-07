package com.openframe.kafka.model;

import lombok.Data;

@Data
public class UserEvent {

    private String userId;
    private String userName;

}
