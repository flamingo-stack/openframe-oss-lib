package com.openframe.test.tests;

import com.openframe.test.api.InvitationApi;
import com.openframe.test.data.db.collections.InvitationsCollection;
import com.openframe.test.data.db.collections.UsersCollection;
import com.openframe.test.data.dto.invitation.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserStatus;
import com.openframe.test.data.generator.InvitationGenerator;
import org.junit.jupiter.api.*;

import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@Tag("oss")
@DisplayName("Invitations")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserInvitationsTest {

    @Order(1)
    @Test
    @DisplayName("Invite New user")
    public void testInviteUser() {
        InvitationRequest invitationRequest = InvitationGenerator.newUserInvitationRequest();
        Invitation apiInvitation = InvitationApi.inviteUser(invitationRequest);
        Invitation dbInvitation = InvitationsCollection.findInvitation(invitationRequest.getEmail());
        assertThat(dbInvitation).as("No invitation found in DB").isNotNull();
        assertThat(apiInvitation).as("API invitation should match DB invitation")
                .usingRecursiveComparison()
                .ignoringFields("updatedAt", "expiresAt", "createdAt").isEqualTo(dbInvitation);
        assertThat(apiInvitation.getCreatedAt()).as("Invitation createdAt should be close to DB value").isCloseTo(dbInvitation.getCreatedAt(), within(1, ChronoUnit.SECONDS));
        assertThat(apiInvitation.getExpiresAt()).as("Invitation expiresAt should be close to DB value").isCloseTo(dbInvitation.getExpiresAt(), within(1, ChronoUnit.SECONDS));
    }

    @Order(2)
    @Test
    @DisplayName("Accept Invitation")
    public void testAcceptInvitation() {
        Invitation dbInvitation = InvitationsCollection.findInvitation(InvitationStatus.PENDING);
        assertThat(dbInvitation).as("No Pending invitation found in DB").isNotNull();
        AcceptInvitationRequest request = InvitationGenerator.acceptInvitationRequest(dbInvitation);
        AcceptInvitationResponse response = InvitationApi.acceptInvitation(request);
        assertThat(response.getEmail()).as("Accepted invitation email should match DB invitation").isEqualTo(dbInvitation.getEmail());
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
        assertThat(response).as("Response should match already accepted error").isEqualTo(expectedResponse);
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
        assertThat(dbInvitation.getStatus()).as("Invitation status should be REVOKED").isEqualTo(InvitationStatus.REVOKED);
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
        assertThat(response).as("Response should match invitation revoked error").isEqualTo(expectedResponse);
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
        assertThat(response).as("Response should match user already exists error").isEqualTo(expectedResponse);
    }


    @Order(9)
    @Test
    @DisplayName("Check that Deleted User can be invited")
    public void testInviteDeletedUser() {
        AuthUser deletedUser = UsersCollection.findUser(UserStatus.DELETED);
        assertThat(deletedUser).as("User is not found in DB").isNotNull();
        InvitationRequest invitationRequest = InvitationGenerator.existingUserInvitationRequest(deletedUser);
        Invitation apiInvitation = InvitationApi.inviteUser(invitationRequest);
        assertThat(apiInvitation.getStatus()).as("Invitation status should be PENDING").isEqualTo(InvitationStatus.PENDING);
        assertThat(apiInvitation.getEmail()).as("Invitation email should match deleted user email").isEqualTo(deletedUser.getEmail());
    }
}
