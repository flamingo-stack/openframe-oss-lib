package com.openframe.data.nats.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientConnectionEvent {

    private String timestamp;
    private Client client;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Client {

        private String name;


    }

}
