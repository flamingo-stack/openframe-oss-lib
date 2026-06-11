package com.openframe.kafka.producer.retry;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class KafkaRecoveryHandlerImpl implements KafkaRecoveryHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void enqueue(Throwable ex, String topic, String key, Object payload) {
        enqueue(ex, topic, key, payload, null);
    }

    @Override
    public void enqueue(Throwable ex, String topic, String key, Object payload, Map<String, Object> headers) {
        // Structured error summary
        log.error(
                "Kafka RECOVER invoked: topic={} key={} headers={} errorClass={} errorMsg={} payload~={}",
                topic,
                key,
                headers,
                (ex == null ? "null" : ex.getClass().getName()),
                (ex == null ? "null" : String.valueOf(ex.getMessage())),
                (payload == null ? "null" : payload.toString()),
                ex // attach stacktrace
        );
    }
}
