package com.openframe.data.document.ticket;

import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.springframework.util.Assert;

// The class name is stored data (owner._class): renaming or moving it needs a data migration.
@Getter
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailTicketOwner extends TicketOwner {

    private String address;

    public EmailTicketOwner(String address) {
        Assert.hasText(address, "address must not be blank");
        this.type = TicketOwnerType.EMAIL;
        this.address = address;
    }
}
