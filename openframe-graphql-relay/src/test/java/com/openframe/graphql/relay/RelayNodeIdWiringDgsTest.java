package com.openframe.graphql.relay;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static com.openframe.graphql.relay.NodeType.MACHINE;
import static com.openframe.graphql.relay.NodeType.NOTIFICATION;
import static com.openframe.graphql.relay.NodeType.SCRIPT;
import static com.openframe.graphql.relay.NodeType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = RelayNodeIdWiringDgsTest.RelayNodesGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/relay-nodes.graphqls")
class RelayNodeIdWiringDgsTest {

    private static final String SCRIPT_ID = "script-1";
    private static final String MACHINE_DOCUMENT_ID = "machine-document-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String NOTIFICATION_ID = "notification-1";
    private static final String TICKET_ID = "ticket-1";
    private static final String USER_ID = "user-1";
    private static final String TAG_ID = "tag-1";

    private final RelayIdCodec codec = new RelayIdCodec();

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Test
    void nodeId_ofANodeType_isTheGlobalIdOfItsRawId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ script { id } }", "data.script.id");

        String expected = codec.encode(SCRIPT, SCRIPT_ID);
        assertThat(id).isEqualTo(expected);
    }

    @Test
    void nodeId_ofANodeTypeWithItsOwnRawKey_encodesThatKey() {
        String id = queryExecutor.executeAndExtractJsonPath("{ machine { id } }", "data.machine.id");

        String expected = codec.encode(MACHINE, MACHINE_ID);
        assertThat(id).isEqualTo(expected);
    }

    @Test
    void nodeId_ofARecordSource_isTheGlobalIdOfItsRawId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ notification { id } }", "data.notification.id");

        String expected = codec.encode(NOTIFICATION, NOTIFICATION_ID);
        assertThat(id).isEqualTo(expected);
    }

    @Test
    void nodeId_ofATypeExtendedWithNode_isTheGlobalIdOfItsRawId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ ticket { id } }", "data.ticket.id");

        String expected = codec.encode(TICKET, TICKET_ID);
        assertThat(id).isEqualTo(expected);
    }

    @Test
    void nodeId_withAnExplicitDataFetcher_keepsThatDataFetcher() {
        String id = queryExecutor.executeAndExtractJsonPath("{ user { id } }", "data.user.id");

        assertThat(id).isEqualTo(USER_ID);
    }

    @Test
    void id_ofATypeOutsideNode_staysRaw() {
        String id = queryExecutor.executeAndExtractJsonPath("{ tag { id } }", "data.tag.id");

        assertThat(id).isEqualTo(TAG_ID);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({DgsAutoConfiguration.class, RelayAutoConfiguration.class})
    @Import(RelayNodesDataFetcher.class)
    static class RelayNodesGraphQlApp {
    }

    @DgsComponent
    static class RelayNodesDataFetcher {

        @DgsQuery
        IdentifiedSource script() {
            return new IdentifiedSource(SCRIPT_ID);
        }

        @DgsQuery
        MachineSource machine() {
            return new MachineSource(MACHINE_DOCUMENT_ID, MACHINE_ID);
        }

        @DgsQuery
        NotificationSource notification() {
            return new NotificationSource(NOTIFICATION_ID);
        }

        @DgsQuery
        IdentifiedSource ticket() {
            return new IdentifiedSource(TICKET_ID);
        }

        @DgsQuery
        IdentifiedSource user() {
            return new IdentifiedSource(USER_ID);
        }

        @DgsQuery
        IdentifiedSource tag() {
            return new IdentifiedSource(TAG_ID);
        }

        @DgsData(parentType = "User", field = "id")
        String userRawId(DgsDataFetchingEnvironment dfe) {
            IdentifiedSource user = dfe.getSource();
            return user.getId();
        }
    }

    @Getter
    @AllArgsConstructor
    static class IdentifiedSource {
        private final String id;
    }

    @Getter
    @AllArgsConstructor
    static class MachineSource {
        private final String id;
        private final String machineId;
    }

    // api's NotificationView is a record, so the wiring must read record accessors too.
    record NotificationSource(String id) {
    }
}
