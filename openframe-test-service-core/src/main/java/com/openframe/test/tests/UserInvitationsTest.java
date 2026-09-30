package com.openframe.test.tests;

import com.openframe.test.api.InvitationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.config.UserConfig;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.db.collections.InvitationsCollection;
import com.openframe.test.data.db.collections.UsersCollection;
import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.invitation.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UpdateUserRequest;
import com.openframe.test.data.dto.user.UserStatus;
import com.openframe.test.data.generator.InvitationGenerator;
import com.openframe.test.data.generator.UserGenerator;
import org.junit.jupiter.api.*;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@Tag("oss")
@Tag("invitations")
@DisplayName("Invitations")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserInvitationsTest extends BaseTest {

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
        // Publish the user this run just created so the delete phase removes exactly this user (self-cleaning),
        // leaving any pre-existing shared admins available for other tests that require them.
        PipelineContext.setInvitedUser(response.getId(), response.getEmail());
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
        // The users collection is global (cross-tenant), so findUser(status, role) can return a user from
        // ANOTHER tenant that this tenant is legitimately allowed to invite (201). The authenticated user
        // is, by definition, an existing member of the current tenant, so target them to assert the conflict.
        AuthUser activeUser = UsersCollection.findUser("email", UserConfig.getEmail());
        assertThat(activeUser).as("Authenticated user is not found in DB").isNotNull();
        InvitationRequest invitationRequest = InvitationGenerator.existingUserInvitationRequest(activeUser);
        InvitationConflictResponse expectedResponse = InvitationGenerator.userAlreadyExistsResponse(activeUser);
        InvitationConflictResponse response = InvitationApi.attemptInviteUser(invitationRequest);
        assertThat(response).as("Response should match user already exists error").isEqualTo(expectedResponse);
    }

    @Order(8)
    @Tag("delete")
    @Test
    @DisplayName("Delete Admin User")
    public void testDeleteUser() {
        // Delete exactly the user this run created (published by Accept) so the run cleans up after itself and
        // leaves shared admins intact. When Accept did not run or failed, invite and accept a throwaway user
        // here instead: the shared tenant's other admins are real people's accounts and must never be deleted.
        String targetId = PipelineContext.hasInvitedUser()
                ? PipelineContext.getInvitedUserId()
                : inviteAndAcceptUser().getId();
        int statusCode = UserApi.deleteUser(targetId);
        assertThat(statusCode).as("Delete user status code should be 204").isEqualTo(204);
        AuthUser deletedUser = UserApi.getUser(targetId);
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).as("User status should be DELETED").isEqualTo(UserStatus.DELETED);
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

    @Tag("feature")
    @Test
    @DisplayName("Resending an invitation that has not expired is refused")
    public void testResendUnexpiredInvitationRefused() {
        // InvitationService.renewInvitation renews only PENDING invitations whose expiry has passed
        // ("Only expired invitations can be resent"); a fresh one is refused with 409, and the E2E suite
        // cannot age an invitation, so the refusal is the contract this case pins down.
        Invitation invitation = InvitationApi.inviteUser(InvitationGenerator.newUserInvitationRequest());
        try {
            assertThat(InvitationApi.attemptResendInvitation(invitation.getId()))
                    .as("A pending invitation that has not expired cannot be resent").isEqualTo(409);
        } finally {
            InvitationApi.revokeInvitation(invitation.getId());
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit the name of an invited user")
    public void testUpdateUserName() {
        AcceptInvitationResponse user = inviteAndAcceptUser();
        try {
            UpdateUserRequest request = UserGenerator.updateUserRequest();
            AuthUser updated = UserApi.updateUser(user.getId(), request);
            assertThat(updated.getId()).as("PUT users/{id} should return the edited user").isEqualTo(user.getId());
            assertThat(updated.getFirstName()).as("Returned first name should be the new one").isEqualTo(request.getFirstName());
            assertThat(updated.getLastName()).as("Returned last name should be the new one").isEqualTo(request.getLastName());
            assertThat(updated.getEmail()).as("Email is not editable and should be unchanged").isEqualTo(user.getEmail());
            assertThat(updated.getRoles()).as("Roles are not editable and should be unchanged").isEqualTo(user.getRoles());
            assertThat(updated.getStatus()).as("Status is not editable and should stay ACTIVE").isEqualTo(UserStatus.ACTIVE);

            AuthUser fetched = UserApi.getUser(user.getId());
            assertThat(fetched.getFirstName()).as("GET users/{id} should show the new first name").isEqualTo(request.getFirstName());
            assertThat(fetched.getLastName()).as("GET users/{id} should show the new last name").isEqualTo(request.getLastName());
        } finally {
            UserApi.deleteUser(user.getId());
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("A first name of 128 characters is accepted and one of 129 is refused")
    public void testUpdateUserNameLengthLimit() {
        // UpdateUserRequest.firstName is @Size(max = 128) under @Valid, so 129 characters fail bean validation
        // (BaseGlobalExceptionHandler: 400 VALIDATION_ERROR) before the user is touched. Only the first name is
        // sent, and a null field is left as is, so the last name must survive both requests.
        AcceptInvitationResponse user = inviteAndAcceptUser();
        try {
            UpdateUserRequest longest = UserGenerator.updateFirstNameRequest(128);
            AuthUser updated = UserApi.updateUser(user.getId(), longest);
            assertThat(updated.getFirstName()).as("A 128-character first name should be saved").isEqualTo(longest.getFirstName());
            assertThat(updated.getLastName()).as("An omitted last name should be left unchanged").isEqualTo(user.getLastName());

            ErrorResponse error = UserApi.attemptUpdateUser(user.getId(), UserGenerator.updateFirstNameRequest(129));
            assertThat(error.getCode()).as("A 129-character first name should fail validation").isEqualTo("VALIDATION_ERROR");
            assertThat(error.getMessage()).as("The validation message should name the field").contains("firstName");

            AuthUser fetched = UserApi.getUser(user.getId());
            assertThat(fetched.getFirstName()).as("A refused edit should leave the first name unchanged").isEqualTo(longest.getFirstName());
            assertThat(fetched.getLastName()).as("A refused edit should leave the last name unchanged").isEqualTo(user.getLastName());
        } finally {
            UserApi.deleteUser(user.getId());
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("A new invitation is listed as pending until it is revoked")
    public void testListPendingInvitations() {
        // InvitationService.listInvitations returns only invitations that are neither ACCEPTED nor REVOKED,
        // so revoking takes an invitation off the list rather than listing it as REVOKED.
        InvitationRequest request = InvitationGenerator.newUserInvitationRequest();
        Invitation invitation = InvitationApi.inviteUser(request);
        try {
            InvitationPageResponse firstPage = InvitationApi.listInvitations(0, 20);
            assertThat(firstPage.getPage()).as("The requested page should be returned").isZero();
            assertThat(firstPage.getSize()).as("The requested page size should be echoed").isEqualTo(20);
            assertThat(firstPage.getTotalElements()).as("The new invitation should be counted").isPositive();

            Invitation listed = listAllInvitations().stream()
                    .filter(item -> item.getId().equals(invitation.getId()))
                    .findFirst().orElse(null);
            assertThat(listed).as("The new invitation should be in the list").isNotNull();
            assertThat(listed.getStatus()).as("The new invitation should be listed as PENDING").isEqualTo(InvitationStatus.PENDING);
            assertThat(listed.getEmail()).as("The listed invitation should carry the invited email").isEqualTo(request.getEmail());
            assertThat(listed.getRoles()).as("The listed invitation should carry the invitation's roles").isEqualTo(invitation.getRoles());
            assertThat(listed.getExpiresAt()).as("The listed invitation should carry the invitation's expiry")
                    .isCloseTo(invitation.getExpiresAt(), within(1, ChronoUnit.SECONDS));
        } finally {
            InvitationApi.revokeInvitation(invitation.getId());
        }
        assertThat(listAllInvitations()).as("A revoked invitation should no longer be listed")
                .extracting(Invitation::getId).doesNotContain(invitation.getId());
    }

    @Tag("feature")
    @Test
    @DisplayName("Listing invitations with size=1 returns a single invitation")
    public void testListInvitationsPageSize() {
        Invitation invitation = InvitationApi.inviteUser(InvitationGenerator.newUserInvitationRequest());
        try {
            InvitationPageResponse page = InvitationApi.listInvitations(0, 1);
            assertThat(page.getItems()).as("size=1 should return exactly one invitation while one is pending").hasSize(1);
            assertThat(page.getSize()).as("The requested page size should be echoed").isEqualTo(1);
            assertThat(page.getTotalPages()).as("With one invitation per page there is a page per invitation")
                    .isEqualTo(page.getTotalElements());
            assertThat(page.isHasNext()).as("hasNext should be true exactly when more than one invitation is pending")
                    .isEqualTo(page.getTotalElements() > 1);
        } finally {
            InvitationApi.revokeInvitation(invitation.getId());
        }
    }

    /** A throwaway active user for this case: a fresh invitation, accepted. The caller deletes it. */
    private AcceptInvitationResponse inviteAndAcceptUser() {
        Invitation invitation = InvitationApi.inviteUser(InvitationGenerator.newUserInvitationRequest());
        try {
            return InvitationApi.acceptInvitation(InvitationGenerator.acceptInvitationRequest(invitation));
        } catch (RuntimeException | AssertionError e) {
            InvitationApi.revokeInvitation(invitation.getId());
            throw e;
        }
    }

    /** Every listed invitation, page by page (the shared tenant can hold more than one page of them). */
    private List<Invitation> listAllInvitations() {
        List<Invitation> all = new ArrayList<>();
        InvitationPageResponse page;
        int index = 0;
        do {
            page = InvitationApi.listInvitations(index++, 100);
            all.addAll(page.getItems());
        } while (page.isHasNext());
        return all;
    }
}
