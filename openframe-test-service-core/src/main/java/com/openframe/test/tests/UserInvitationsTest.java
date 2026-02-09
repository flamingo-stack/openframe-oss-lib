package com.openframe.test.tests;

import com.openframe.test.api.InvitationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.data.db.collections.InvitationsCollection;
import com.openframe.test.data.db.collections.UsersCollection;
import com.openframe.test.data.dto.invitation.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.generator.InvitationGenerator;
import com.openframe.test.tests.base.AuthorizedTest;
import org.junit.jupiter.api.*;

import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@Tag("oss")
@DisplayName("Invitations and Users")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserInvitationsTest extends AuthorizedTest {

    @Order(1)
    @Test
    @DisplayName("Invite New user")
    public void testInviteUser() {
        InvitationRequest invitationRequest = InvitationGenerator.newUserInvitationRequest();
        Invitation apiInvitation = InvitationApi.inviteUser(invitationRequest);
        Invitation dbInvitation = InvitationsCollection.findInvitation(invitationRequest.getEmail());
        assertThat(dbInvitation).as("No invitation found in DB").isNotNull();
        assertThat(apiInvitation).usingRecursiveComparison()
                .ignoringFields("updatedAt", "expiresAt", "createdAt").isEqualTo(dbInvitation);
        assertThat(apiInvitation.getCreatedAt()).isCloseTo(dbInvitation.getCreatedAt(), within(1, ChronoUnit.SECONDS));
        assertThat(apiInvitation.getExpiresAt()).isCloseTo(dbInvitation.getExpiresAt(), within(1, ChronoUnit.SECONDS));
    }

    @Order(2)
    @Test
    @DisplayName("Accept Invitation")
    public void testAcceptInvitation() {
        Invitation dbInvitation = InvitationsCollection.findInvitation(InvitationStatus.PENDING);
        assertThat(dbInvitation).as("No Pending invitation found in DB").isNotNull();
        AcceptInvitationRequest request = InvitationGenerator.acceptInvitationRequest(dbInvitation);
        AcceptInvitationResponse response = InvitationApi.acceptInvitation(request);
        assertThat(response.getEmail()).isEqualTo(dbInvitation.getEmail());
    }

    @Order(3)
    @Test
    @DisplayName("Check that already Accepted Invitation cannot be accepted")
    public void testAcceptAcceptedInvitation() {
        Invitation dbInvitation = InvitationsCollection.findInvitation(InvitationStatus.ACCEPTED);
        assertThat(dbInvitation).as("No Accepted invitation found in DB").isNotNull();
        AcceptInvitationRequest request = InvitationGenerator.acceptInvitationRequest(dbInvitation);
        InvitationConflictResponse expectedResponse = InvitationGenerator.alreadyAcceptedResponse();
        InvitationConflictResponse response = InvitationApi.attemptAcceptInvitation(request);
        assertThat(response).isEqualTo(expectedResponse);
    }

    @Order(4)
    @Test
    @DisplayName("Revoke Invitation")
    public void testRevokeInvitation() {
        InvitationRequest invitationRequest = InvitationGenerator.newUserInvitationRequest();
        Invitation apiInvitation = InvitationApi.inviteUser(invitationRequest);
        InvitationApi.revokeInvitation(apiInvitation.getId());
        Invitation dbInvitation = InvitationsCollection.findInvitation(invitationRequest.getEmail());
        assertThat(dbInvitation).as("No invitation found in DB").isNotNull();
        assertThat(dbInvitation.getStatus()).isEqualTo(InvitationStatus.REVOKED);
    }

    @Order(5)
    @Test
    @DisplayName("Check that Revoked Invitation cannot be accepted")
    public void testAcceptRevokedInvitation() {
        Invitation dbInvitation = InvitationsCollection.findInvitation(InvitationStatus.REVOKED);
        assertThat(dbInvitation).as("No Revoked invitation found in DB").isNotNull();
        AcceptInvitationRequest request = InvitationGenerator.acceptInvitationRequest(dbInvitation);
        InvitationConflictResponse expectedResponse = InvitationGenerator.invitationRevokedResponse();
        InvitationConflictResponse response = InvitationApi.attemptAcceptInvitation(request);
        assertThat(response).isEqualTo(expectedResponse);
    }

    @Order(6)
    @Test
    @DisplayName("Check that Existing User cannot be invited")
    public void testInviteActiveUser() {
        AuthUser activeUser = UsersCollection.findUser(UserStatus.ACTIVE);
        assertThat(activeUser).as("User is not found in DB").isNotNull();
        InvitationRequest invitationRequest = InvitationGenerator.existingUserInvitationRequest(activeUser);
        InvitationConflictResponse expectedResponse = InvitationGenerator.userAlreadyExistsResponse(activeUser);
        InvitationConflictResponse response = InvitationApi.attemptInviteUser(invitationRequest);
        assertThat(response).isEqualTo(expectedResponse);
    }

    @Order(7)
    @Test
    @DisplayName("Delete Admin User")
    public void testDeleteUser() {
        AuthUser user = UsersCollection.findUser(UserStatus.ACTIVE);
        assertThat(user).as("User is not found in DB").isNotNull();
        int statusCode = UserApi.deleteUser(user.getId());
        user = UsersCollection.findUser(user.getId());
        assertThat(statusCode).isEqualTo(204);
        assertThat(user).as("User is not found in DB").isNotNull();
        assertThat(user.getStatus()).isEqualTo(UserStatus.DELETED);
    }

    @Order(8)
    @Test
    @DisplayName("Check that Owner User cannot be deleted")
    public void testDeleteOwner() {
        AuthUser user = UsersCollection.findUser(UserRole.OWNER);
        assertThat(user).as("User is not found in DB").isNotNull();
        int statusCode = UserApi.deleteUser(user.getId());
        user = UsersCollection.findUser(user.getId());
        assertThat(statusCode).isEqualTo(409);
        assertThat(user).as("User is not found in DB").isNotNull();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Order(9)
    @Test
    @DisplayName("Check that Deleted User can be invited")
    public void testInviteDeletedUser() {
        AuthUser deletedUser = UsersCollection.findUser(UserStatus.DELETED);
        assertThat(deletedUser).as("User is not found in DB").isNotNull();
        InvitationRequest invitationRequest = InvitationGenerator.existingUserInvitationRequest(deletedUser);
        Invitation apiInvitation = InvitationApi.inviteUser(invitationRequest);
        assertThat(apiInvitation.getStatus()).isEqualTo(InvitationStatus.PENDING);
        assertThat(apiInvitation.getEmail()).isEqualTo(deletedUser.getEmail());
    }
}
