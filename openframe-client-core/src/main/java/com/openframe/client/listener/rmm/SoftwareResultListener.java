package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.RmmResultService;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import com.openframe.data.nats.rmm.model.ScriptResultMessage;
import io.nats.client.Connection;
import org.springframework.stereotype.Component;

@Component
public class SoftwareResultListener extends AbstractRmmResultListener<ScriptResultMessage> {

    public SoftwareResultListener(Connection natsConnection,
                                  RmmResultParser resultParser,
                                  RmmResultService rmmResultService,
                                  NatsTopicMachineIdExtractor machineIdExtractor) {
        super(natsConnection, resultParser, rmmResultService, machineIdExtractor);
    }

    @Override
    protected String subject() {
        return "machine.*.software-execution.result";
    }

    @Override
    protected Class<ScriptResultMessage> messageType() {
        return ScriptResultMessage.class;
    }

    @Override
    protected String label() {
        return "software";
    }
}
