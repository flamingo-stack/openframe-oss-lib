package com.openframe.test.tests;

import com.openframe.test.api.InvitationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.api.auth.AuthFlow;
import com.openframe.test.config.UserConfig;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.invitation.AcceptInvitationResponse;
import com.openframe.test.data.dto.invitation.Invitation;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.dto.user.UserStatus;
import com.openframe.test.data.generator.InvitationGenerator;
import io.restassured.response.Response;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;


@Tag("oss")
@Tag("users")
@DisplayName("Users")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserTest extends BaseTest {

    private static String ownerId;
    private static List<UserRole> ownerRoles;
    private static Invitation pendingInvitation;
    private static AcceptInvitationResponse throwaway;
    private static Map<String, String> throwawayCookies;
    private static boolean ownershipAway;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("List users")
    @Order(1)
    public void testListUsers() {
        List<AuthUser> users = UserApi.getUsers();
        assertThat(users).allSatisfy(user -> {
            assertThat(user.getId()).as("User id should not be empty").isNotEmpty();
            assertThat(user.getEmail()).as("User email should not be empty").isNotEmpty();
            assertThat(user.getFirstName()).as("User firstName should not be empty").isNotEmpty();
            assertThat(user.getLastName()).as("User lastName should not be empty").isNotEmpty();
            assertThat(user.getRoles()).as("User roles should not be empty").isNotEmpty();
            assertThat(user.getStatus()).as("User status should not be null").isNotNull();
            assertThat(user.getUpdatedAt()).as("User updatedAt should not be null").isNotNull();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Get user")
    @Order(2)
    public void testGetUsers() {
        List<AuthUser> users = UserApi.getUsers();
        AuthUser user = UserApi.getUser(users.getFirst().getId());
        assertThat(user).as("Retrieved user should match listed user").isEqualTo(users.getFirst());
    }


    @Tag("delete")
    @Test
    @DisplayName("Check that Owner User cannot be deleted")
    @Disabled("Until new logic for delete user implemented")
    @Order(3)
    public void testDeleteOwner() {
        List<AuthUser> users = UserApi.getUsers(UserRole.OWNER);
        assertThat(users).as("No active Admin users").isNotEmpty();
        int statusCode = UserApi.deleteUser(users.getFirst().getId());
        assertThat(statusCode).as("Delete owner status code should be 409").isEqualTo(409);
        AuthUser deletedUser = UserApi.getUser(users.getFirst().getId());
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).as("Owner status should remain ACTIVE").isEqualTo(UserStatus.ACTIVE);
    }

    // ── Transferring tenant ownership (CP-46) ──────────────────────────────────────────────────────────

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("The suite's user is the tenant owner")
    @Order(4)
    public void testSuiteUserIsOwner() {
        String meId = UserApi.me().getUser().getId();

        AuthUser me = UserApi.getUser(meId);

        assertThat(me.getRoles()).as("Only the owner can transfer ownership, so the suite's user should hold OWNER")
                .contains(UserRole.OWNER);
        assertThat(me.getStatus()).as("The owner should be ACTIVE").isEqualTo(UserStatus.ACTIVE);
        ownerId = meId;
        ownerRoles = me.getRoles();
    }

    @Tag("feature")
    @Test
    @DisplayName("Transferring ownership to yourself changes nothing")
    @Order(5)
    public void testTransferOwnershipToSelf() {
        requireOwner();

        Response response = UserApi.attemptTransferOwnership(ownerId);

        assertThat(response.getStatusCode()).as("A transfer to yourself is accepted as a no-op (204)").isEqualTo(204);
        assertThat(UserApi.getUser(ownerId).getRoles()).as("The owner's roles are unchanged").isEqualTo(ownerRoles);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Transferring ownership to an unknown user is not found")
    @Order(6)
    public void testTransferOwnershipToUnknownUser() {
        requireOwner();
        String unknownId = UUID.randomUUID().toString();

        Response response = UserApi.attemptTransferOwnership(unknownId);

        assertThat(response.getStatusCode()).as("An unknown target is 404").isEqualTo(404);
        ErrorResponse error = response.as(ErrorResponse.class);
        assertThat(error.getCode()).as("The error code names the missing user").isEqualTo("USER_NOT_FOUND");
        assertThat(error.getMessage()).as("The message carries the id").isEqualTo("User not found: " + unknownId);
        assertThat(UserApi.getUser(ownerId).getRoles()).as("The owner's roles are unchanged").isEqualTo(ownerRoles);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Transferring ownership to a pending invitee is refused")
    @Order(7)
    public void testTransferOwnershipToPendingInvitee() {
        requireOwner();
        pendingInvitation = InvitationApi.inviteUser(InvitationGenerator.newUserInvitationRequest());

        Response response = UserApi.attemptTransferOwnership(pendingInvitation.getId());

        // A pending invitee has no user account yet, so its invitation id resolves to no user.
        assertThat(response.getStatusCode()).as("A pending invitee is not a user (404)").isEqualTo(404);
        assertThat(response.as(ErrorResponse.class).getCode()).as("The error code names the missing user")
                .isEqualTo("USER_NOT_FOUND");
        assertThat(UserApi.getUser(ownerId).getRoles()).as("The owner's roles are unchanged").isEqualTo(ownerRoles);
        InvitationApi.revokeInvitation(pendingInvitation.getId());
        pendingInvitation = null;
    }

    @Tag("feature")
    @Test
    @DisplayName("Create a throwaway admin to transfer ownership with")
    @Order(8)
    public void testCreateThrowawayAdmin() {
        Invitation invitation = InvitationApi.inviteUser(InvitationGenerator.newUserInvitationRequest());
        throwaway = InvitationApi.acceptInvitation(InvitationGenerator.acceptInvitationRequest(invitation));

        AuthUser fetched = UserApi.getUser(throwaway.getId());

        assertThat(fetched.getStatus()).as("The throwaway user is ACTIVE").isEqualTo(UserStatus.ACTIVE);
        assertThat(fetched.getRoles()).as("The throwaway user is an ADMIN, not an owner").containsExactly(UserRole.ADMIN);
        throwawayCookies = AuthFlow.login(throwawayLogin());
        assertThat(throwawayCookies).as("The throwaway admin can log in").containsKey("access_token");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("An admin who is not the owner cannot transfer ownership")
    @Order(9)
    public void testNonOwnerCannotTransferOwnership() {
        requireThrowaway();

        Response response = UserApi.attemptTransferOwnership(throwaway.getId(), throwawayCookies);

        assertThat(response.getStatusCode()).as("A non-owner caller is forbidden (403)").isEqualTo(403);
        ErrorResponse error = response.as(ErrorResponse.class);
        assertThat(error.getCode()).as("The OWNER authority check refuses it").isEqualTo("FORBIDDEN");
        assertThat(error.getMessage()).as("The access-denied message").isEqualTo("Access denied");
        assertThat(UserApi.getUser(throwaway.getId()).getRoles()).as("The admin did not become owner")
                .containsExactly(UserRole.ADMIN);
    }

    @Tag("feature")
    @Test
    @DisplayName("The owner transfers ownership to an admin")
    @Order(10)
    public void testTransferOwnershipToAdmin() {
        assumeTrue(PipelineContext.hasRegisteredTenant(), "Demotes the tenant owner, so it runs only on a pipeline-registered tenant");
        requireOwner();
        requireThrowaway();

        UserApi.transferOwnership(throwaway.getId());
        ownershipAway = true;

        assertThat(UserApi.getUser(throwaway.getId()).getRoles()).as("The new owner holds only OWNER")
                .containsExactly(UserRole.OWNER);
        assertThat(UserApi.getUser(ownerId).getRoles()).as("The previous owner is demoted to ADMIN")
                .containsExactly(UserRole.ADMIN);
        assertThat(UserApi.attemptTransferOwnership(ownerId).getStatusCode())
                .as("The demoted owner can no longer transfer ownership").isEqualTo(403);
    }

    @Tag("feature")
    @Test
    @DisplayName("The new owner transfers ownership back")
    @Order(11)
    public void testTransferOwnershipBack() {
        assumeTrue(PipelineContext.hasRegisteredTenant(), "Needs the demoted owner of a pipeline-registered tenant");
        assumeTrue(ownershipAway, "Ownership was not transferred in \"The owner transfers ownership to an admin\"; see that failure");

        // A fresh login, since the earlier session's token was minted while the user was only an ADMIN.
        UserApi.transferOwnership(ownerId, AuthFlow.login(throwawayLogin()));
        ownershipAway = false;

        assertThat(UserApi.getUser(ownerId).getRoles()).as("The original owner holds only OWNER again")
                .containsExactly(UserRole.OWNER);
        assertThat(UserApi.getUser(throwaway.getId()).getRoles()).as("The interim owner is demoted to ADMIN")
                .containsExactly(UserRole.ADMIN);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Transferring ownership to a deleted user is refused")
    @Order(12)
    public void testTransferOwnershipToDeletedUser() {
        requireOwner();
        requireThrowaway();
        assumeTrue(!ownershipAway, "Ownership was not transferred back in \"The new owner transfers ownership back\"; see that failure");
        assertThat(UserApi.deleteUser(throwaway.getId())).as("The throwaway admin is deleted").isEqualTo(204);
        assertThat(UserApi.getUser(throwaway.getId()).getStatus()).as("The throwaway admin is DELETED")
                .isEqualTo(UserStatus.DELETED);

        Response response = UserApi.attemptTransferOwnership(throwaway.getId());

        assertThat(response.getStatusCode()).as("A deleted target is refused (403)").isEqualTo(403);
        ErrorResponse error = response.as(ErrorResponse.class);
        assertThat(error.getCode()).as("The service refuses a non-active target").isEqualTo("OPERATION_NOT_ALLOWED");
        assertThat(error.getMessage()).as("The refusal names the reason")
                .isEqualTo("Ownership can only be transferred to an active user");
        assertThat(UserApi.getUser(ownerId).getRoles()).as("The owner's roles are unchanged").isEqualTo(ownerRoles);
    }

    @AfterAll
    public static void cleanup() {
        if (ownershipAway) {
            UserApi.attemptTransferOwnership(ownerId, AuthFlow.login(throwawayLogin()));
        }
        if (pendingInvitation != null) {
            InvitationApi.attemptRevokeInvitation(pendingInvitation.getId());
        }
        if (throwaway != null) {
            UserApi.deleteUser(throwaway.getId());
        }
    }

    private static void requireOwner() {
        assumeTrue(ownerId != null, "The suite's user was not confirmed as owner in \"The suite's user is the tenant owner\"; see that failure");
    }

    private static void requireThrowaway() {
        assumeTrue(throwawayCookies != null, "No throwaway admin was created in \"Create a throwaway admin to transfer ownership with\"; see that failure");
    }

    private static User throwawayLogin() {
        return User.builder()
                .email(throwaway.getEmail())
                .password(UserConfig.getPassword())
                .domain(UserConfig.getDomain())
                .build();
    }
}
