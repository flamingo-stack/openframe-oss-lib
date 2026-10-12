package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static com.openframe.graphql.relay.NodeType.INVITATION;
import static com.openframe.graphql.relay.NodeType.USER;
import static org.assertj.core.api.Assertions.assertThat;

/** User and Invitation ids are Relay global ids, wired like every other Node id. */
@SpringBootTest(
        classes = UserNodeIdDgsTest.RelayUserNodeGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/relay-user-node.graphqls")
class UserNodeIdDgsTest {

    private static final String USER_ID = "3f0c2a52-8a51-4d55-9c3b-0f6b7c9d2e11";
    private static final String INVITATION_ID = "01595181-34a4-40b4-bf5b-a45bdcae07db";

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Test
    void userId_isAGlobalId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ user { id } }", "data.user.id");

        assertThat(id).isEqualTo(new RelayIdCodec().encode(USER, USER_ID));
    }

    @Test
    void invitationId_isAGlobalId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ invitation { id } }", "data.invitation.id");

        assertThat(id).isEqualTo(new RelayIdCodec().encode(INVITATION, INVITATION_ID));
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({DgsAutoConfiguration.class, RelayAutoConfiguration.class})
    @Import(RelayUserNodeQueries.class)
    static class RelayUserNodeGraphQlApp {
    }

    @DgsComponent
    static class RelayUserNodeQueries {

        @DgsQuery
        UserResponse user() {
            return UserResponse.builder().id(USER_ID).build();
        }

        @DgsQuery
        InvitationResponse invitation() {
            return InvitationResponse.builder().id(INVITATION_ID).build();
        }
    }
}
