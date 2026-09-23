package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.RmmResultService;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import com.openframe.data.nats.rmm.model.ScriptResultMessage;
import io.nats.client.Connection;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ScriptResultListener extends AbstractRmmResultListener<ScriptResultMessage> {

    private final String subject;

    public ScriptResultListener(Connection natsConnection,
                                RmmResultParser resultParser,
                                RmmResultService rmmResultService,
                                NatsTopicMachineIdExtractor machineIdExtractor,
                                @Value("${openframe.oss-tenant.kafka.topics.script-execution-result:machine.*.script-execution.result}") String subject) {
        super(natsConnection, resultParser, rmmResultService, machineIdExtractor);
        this.subject = subject;
    }

    @Override
    protected String subject() {
        return subject;
    }

    @Override
    protected Class<ScriptResultMessage> messageType() {
        return ScriptResultMessage.class;
    }

    @Override
    protected String label() {
        return "script";
    }
}
