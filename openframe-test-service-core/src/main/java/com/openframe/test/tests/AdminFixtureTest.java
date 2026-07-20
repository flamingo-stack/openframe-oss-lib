package com.openframe.test.tests;

import com.openframe.test.api.InvitationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.invitation.AcceptInvitationRequest;
import com.openframe.test.data.dto.invitation.AcceptInvitationResponse;
import com.openframe.test.data.dto.invitation.Invitation;
import com.openframe.test.data.dto.invitation.InvitationRequest;
import com.openframe.test.data.generator.InvitationGenerator;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pipeline-scoped ADMIN user fixture.
 *
 * <p>A freshly registered tenant has only the OWNER, which is a distinct role from ADMIN. Tests that
 * require an admin member (e.g. ticket assignment via {@code getUsers(ADMIN)}) would find none. The
 * e2e pipeline runs {@code admin-setup} before the functional phase to invite + accept one admin and
 * publish it to {@link PipelineContext}, then {@code admin-teardown} at the very end to delete it — so
 * exactly one admin exists for the whole run regardless of cross-class test ordering.
 */
@Tag("oss")
@DisplayName("Admin fixture")
@Slf4j
public class AdminFixtureTest extends BaseTest {

    @Tag("admin-setup")
    @Test
    @DisplayName("Set up pipeline admin user")
    public void setupAdminUser() {
        InvitationRequest request = InvitationGenerator.newUserInvitationRequest();
        Invitation invitation = InvitationApi.inviteUser(request);
        AcceptInvitationRequest acceptRequest = InvitationGenerator.acceptInvitationRequest(invitation);
        AcceptInvitationResponse response = InvitationApi.acceptInvitation(acceptRequest);
        assertThat(response.getId()).as("Admin fixture user id should not be null").isNotNull();
        PipelineContext.setFixtureAdmin(response.getId(), response.getEmail());
        log.info("Admin fixture user created: {} ({})", response.getEmail(), response.getId());
    }

    @Tag("admin-teardown")
    @Test
    @DisplayName("Tear down pipeline admin user")
    public void teardownAdminUser() {
        if (!PipelineContext.hasFixtureAdmin()) {
            log.info("No admin fixture user to tear down");
            return;
        }
        int statusCode = UserApi.deleteUser(PipelineContext.getFixtureAdminId());
        log.info("Admin fixture user {} deleted (status {})", PipelineContext.getFixtureAdminId(), statusCode);
    }
}
