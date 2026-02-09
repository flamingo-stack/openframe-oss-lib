package com.openframe.test.data.generator;

import com.openframe.test.data.dto.invitation.AcceptInvitationRequest;
import com.openframe.test.data.dto.invitation.Invitation;
import com.openframe.test.data.dto.invitation.InvitationConflictResponse;
import com.openframe.test.data.dto.invitation.InvitationRequest;
import com.openframe.test.data.dto.user.AuthUser;
import net.datafaker.Faker;

import static com.openframe.test.config.UserConfig.DEFAULT_PASSWORD;

public class InvitationGenerator {

    private static final Faker faker = new Faker();

    public static InvitationRequest newUserInvitationRequest() {
        return InvitationRequest.builder().email(faker.internet().emailAddress()).build();
    }

    public static InvitationRequest existingUserInvitationRequest(AuthUser user) {
        return InvitationRequest.builder().email(user.getEmail()).build();
    }

    public static AcceptInvitationRequest acceptInvitationRequest(Invitation invitation) {
        return AcceptInvitationRequest.builder()
                .invitationId(invitation.getId())
                .firstName(faker.name().firstName())
                .lastName(faker.name().lastName())
                .password(DEFAULT_PASSWORD)
                .build();
    }

    public static InvitationConflictResponse alreadyAcceptedResponse() {
        return InvitationConflictResponse.builder()
                .code("CONFLICT")
                .message("Invitation already used or revoked")
                .build();
    }

    public static InvitationConflictResponse invitationRevokedResponse() {
        return alreadyAcceptedResponse();
    }

    public static InvitationConflictResponse userAlreadyExistsResponse(AuthUser user) {
        return InvitationConflictResponse.builder()
                .code("CONFLICT")
                .message("User with email %s already exists in tenant".formatted(user.getEmail()))
                .build();
    }
}
