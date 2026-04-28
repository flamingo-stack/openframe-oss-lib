package com.openframe.data.document.auth;

import com.openframe.data.document.user.Invitation;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(
        def = "{'tenantId': 1, 'email': 1}",
        unique = true
)
public class AuthInvitation extends Invitation {
}