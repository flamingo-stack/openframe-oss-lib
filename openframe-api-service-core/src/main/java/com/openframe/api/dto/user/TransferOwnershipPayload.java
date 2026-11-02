package com.openframe.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransferOwnershipPayload {
    private UserResponse previousOwner;
    private UserResponse newOwner;
}
