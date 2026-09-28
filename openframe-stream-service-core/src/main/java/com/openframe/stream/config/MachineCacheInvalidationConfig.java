package com.openframe.stream.config;

import com.openframe.stream.listener.MachineCacheInvalidationListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import static com.openframe.data.repository.redis.MachineIdCacheService.INVALIDATION_CHANNEL;

@Configuration
@ConditionalOnProperty(name = "openframe.machine-id.cache.enabled", havingValue = "true")
public class MachineCacheInvalidationConfig {

    @Bean
    public RedisMessageListenerContainer machineCacheInvalidationListenerContainer(
            RedisConnectionFactory connectionFactory,
            MachineCacheInvalidationListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        ChannelTopic topic = new ChannelTopic(INVALIDATION_CHANNEL);
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listener, topic);
        return container;
    }
}
