package com.openframe.data.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClientConnectionEvent {

    private String timestamp;
    private Client client;

    @Getter
    @Setter
    public static class Client {

        private String name;


    }

}
