package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.RmmResultService;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import io.nats.client.Connection;
import org.springframework.stereotype.Component;

@Component
public class CommandResultListener extends AbstractRmmResultListener<CommandResultMessage> {

    public CommandResultListener(Connection natsConnection,
                                 RmmResultParser resultParser,
                                 RmmResultService rmmResultService,
                                 NatsTopicMachineIdExtractor machineIdExtractor) {
        super(natsConnection, resultParser, rmmResultService, machineIdExtractor);
    }

    @Override
    protected String subject() {
        return "machine.*.command-execution.result";
    }

    @Override
    protected Class<CommandResultMessage> messageType() {
        return CommandResultMessage.class;
    }

    @Override
    protected String label() {
        return "command";
    }
}
