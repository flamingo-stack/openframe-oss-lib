package com.openframe.api.relay;

import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NodeTypeResolverTest {

    private static final String DIALOG_ID = "665f1c2ab3e4d5f6a7b8c9e1";

    private final NodeTypeResolver resolver = new NodeTypeResolver();

    @Test
    void resolveNode_federatedReference_referenceTypeName() {
        // setup
        FederatedNodeReference reference = new FederatedNodeReference("Dialog", DIALOG_ID);

        // execution
        String type = resolver.resolveNode(reference);

        // verifications
        assertThat(type).isEqualTo("Dialog");
    }

    @Test
    void resolveNode_machine_machine() {
        // setup
        Machine machine = new Machine();

        // execution
        String type = resolver.resolveNode(machine);

        // verifications
        assertThat(type).isEqualTo("Machine");
    }
}
