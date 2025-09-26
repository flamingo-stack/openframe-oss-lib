package com.openframe.kafka.producer.retry;


import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class KafkaRecoveryHandlerImpl implements KafkaRecoveryHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void enqueue(Throwable ex, String topic, String key, Object payload) {
        String payloadJson = payload.toString();

        // Structured error summary
        log.error(
                "Kafka RECOVER invoked: topic={} key={} errorClass={} errorMsg={} payload~={}",
                topic,
                key,
                (ex == null ? "null" : ex.getClass().getName()),
                (ex == null ? "null" : String.valueOf(ex.getMessage())),
                payloadJson,
                ex // attach stacktrace
        );
    }
}
