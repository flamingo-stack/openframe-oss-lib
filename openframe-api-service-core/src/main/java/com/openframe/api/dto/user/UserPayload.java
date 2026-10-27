package com.openframe.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The payload of updateUser and deleteUser: the user as it is after the change. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPayload {
    private UserResponse user;
}
