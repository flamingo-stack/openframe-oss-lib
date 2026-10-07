package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static com.openframe.graphql.relay.NodeType.SCRIPT;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = UserIdDataFetcherDgsTest.RelayUserNodeGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/relay-user-node.graphqls")
class UserIdDataFetcherDgsTest {

    private static final String USER_ID = "user-1";
    private static final String SCRIPT_ID = "script-1";

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Test
    void userId_staysRaw() {
        String id = queryExecutor.executeAndExtractJsonPath("{ user { id } }", "data.user.id");

        assertThat(id).isEqualTo(USER_ID);
    }

    @Test
    void scriptId_nextToTheRawUserId_isAGlobalId() {
        String id = queryExecutor.executeAndExtractJsonPath("{ script { id } }", "data.script.id");

        String expected = new RelayIdCodec().encode(SCRIPT, SCRIPT_ID);
        assertThat(id).isEqualTo(expected);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({DgsAutoConfiguration.class, RelayAutoConfiguration.class})
    @Import({UserIdDataFetcher.class, RelayUserNodeQueries.class})
    static class RelayUserNodeGraphQlApp {
    }

    @DgsComponent
    static class RelayUserNodeQueries {

        @DgsQuery
        UserResponse user() {
            return UserResponse.builder().id(USER_ID).build();
        }

        @DgsQuery
        ScriptResponse script() {
            return ScriptResponse.builder().id(SCRIPT_ID).build();
        }
    }
}
