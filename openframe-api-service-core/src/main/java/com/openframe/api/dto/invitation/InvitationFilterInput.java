package com.openframe.api.dto.invitation;

import com.openframe.data.document.user.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationFilterInput {
    /** PENDING and/or EXPIRED; empty means both. */
    private List<InvitationStatus> statuses;

    /** The roles the invitee gets; empty means any. */
    private List<UserRole> roles;

    /** {@code true}: only expired, {@code false}: only pending, {@code null}: both. */
    public Boolean expiredOnly() {
        if (statuses == null) {
            return null;
        }
        boolean pending = statuses.contains(InvitationStatus.PENDING);
        boolean expired = statuses.contains(InvitationStatus.EXPIRED);
        return pending == expired ? null : expired;
    }
}
