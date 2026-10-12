package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import com.openframe.api.config.DateScalarConfig;
import com.openframe.api.config.InstantScalarConfig;
import com.openframe.api.config.JsonScalarConfig;
import com.openframe.api.config.LongScalarConfig;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.invitation.InvitationStatus;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.MutationError;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.InvitationService.InviteUsersResult;
import com.openframe.api.service.user.UserService;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.openframe.graphql.relay.NodeType.INVITATION;
import static com.openframe.graphql.relay.NodeType.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The mutations of the real user.graphqls, executed through DGS: inputs bind, payloads serialize, ids are global. */
@SpringBootTest(
        classes = UserMutationsDgsTest.UserMutationsGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:schema/shared.graphqls,classpath:schema/user.graphqls")
class UserMutationsDgsTest {

    private static final RelayIdCodec CODEC = new RelayIdCodec();

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @MockBean
    private UserService userService;

    @MockBean
    private InvitationService invitationService;

    @Test
    @DisplayName("inviteUsers: edges with global ids and cursors, refusals as userErrors")
    void inviteUsers() {
        InvitationResponse sent = InvitationResponse.builder().id("inv-1").email("a@acme.io")
                .status(InvitationStatus.PENDING).createdAt(Instant.EPOCH).roles(List.of()).build();
        when(invitationService.inviteUsers(List.of("a@acme.io", "nope"))).thenReturn(new InviteUsersResult(
                List.of(sent),
                List.of(MutationError.builder().field(List.of("emails", "1")).message("Invalid email format").build())));

        Map<String, Object> payload = queryExecutor.executeAndExtractJsonPath("""
                mutation { inviteUsers(input: { emails: ["a@acme.io", "nope"] }) {
                    invitationEdges { cursor node { id email status } }
                    userErrors { field message }
                } }""", "data.inviteUsers");

        assertThat(payload).isEqualTo(Map.of(
                "invitationEdges", List.of(Map.of(
                        "cursor", CursorCodec.encode("0_inv-1"),
                        "node", Map.of("id", CODEC.encode(INVITATION, "inv-1"), "email", "a@acme.io", "status", "PENDING"))),
                "userErrors", List.of(Map.of("field", List.of("emails", "1"), "message", "Invalid email format"))));
    }

    @Test
    @DisplayName("revokeInvitation: the input id is decoded and the revoked id comes back global")
    void revokeInvitation() {
        String id = CODEC.encode(INVITATION, "inv-1");

        String revoked = queryExecutor.executeAndExtractJsonPath(
                "mutation($id: ID!) { revokeInvitation(input: { id: $id }) { revokedInvitationId } }",
                "data.revokeInvitation.revokedInvitationId", Map.of("id", id));

        verify(invitationService).revokeInvitation("inv-1");
        assertThat(revoked).isEqualTo(id);
    }

    @Test
    @DisplayName("updateUser: the payload user has a global id and the new name")
    void updateUser() {
        when(userService.updateUser(eq("u-1"), any()))
                .thenReturn(UserResponse.builder().id("u-1").firstName("Jane").status("ACTIVE").emailVerified(true)
                        .roles(List.of()).build());

        Map<String, Object> user = queryExecutor.executeAndExtractJsonPath(
                "mutation($id: ID!) { updateUser(input: { id: $id, firstName: \"Jane\" }) { user { id firstName status emailVerified } } }",
                "data.updateUser.user", Map.of("id", CODEC.encode(USER, "u-1")));

        assertThat(user).isEqualTo(Map.of(
                "id", CODEC.encode(USER, "u-1"), "firstName", "Jane", "status", "ACTIVE", "emailVerified", true));
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({DgsAutoConfiguration.class, RelayAutoConfiguration.class})
    @Import({UserDataFetcher.class, InvitationDataFetcher.class, GraphQLUserMapper.class, InstantScalarConfig.class,
            DateScalarConfig.class, LongScalarConfig.class, JsonScalarConfig.class})
    static class UserMutationsGraphQlApp {
    }
}
