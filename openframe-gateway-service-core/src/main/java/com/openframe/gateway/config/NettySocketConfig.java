package com.openframe.gateway.config;

import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.embedded.netty.NettyReactiveWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.cloud.gateway.config.HttpClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.socket.client.ReactorNettyWebSocketClient;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

@Slf4j
@Configuration
public class NettySocketConfig {

    @Bean
    public WebServerFactoryCustomizer<NettyReactiveWebServerFactory> nettyServerCustomizer() {
        return factory -> factory.addServerCustomizers(httpServer ->
                httpServer
                        .childOption(ChannelOption.SO_LINGER, 0)
                        .childOption(ChannelOption.TCP_NODELAY, true)
        );
    }

    @Bean
    public HttpClientCustomizer gatewayHttpClientCustomizer() {
        return httpClient -> httpClient
                .option(ChannelOption.SO_LINGER, 0)
                .option(ChannelOption.TCP_NODELAY, true);
    }

    @Bean("reactorNettyWebSocketClient")
    public WebSocketClient reactorNettyWebSocketClient() {
        // Unpooled + graceful close: WS upstreams are long-lived per session; a pooled, non-evicted idle connection can be handed out already closed (AbortedException before send), and SO_LINGER=0 would RST it.
        HttpClient httpClient = HttpClient.create(ConnectionProvider.newConnection())
                .option(ChannelOption.TCP_NODELAY, true);
        return new ReactorNettyWebSocketClient(httpClient);
    }
}
