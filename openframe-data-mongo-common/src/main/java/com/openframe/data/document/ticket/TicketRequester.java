package com.openframe.data.document.ticket;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.springframework.util.Assert;

/**
 * The directory account an email ticket's sender was matched to, with the name and address it had at that time.
 * The builder is the only write path and rejects a missing account, match kind or matched address;
 * a stored document is read as it is.
 */
@Getter
@ToString
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketRequester {

    private String accountId;
    private String name;
    private String email;
    // Name of the directory provider the account comes from, e.g. MICROSOFT_365.
    private String directoryProvider;
    private TicketRequesterMatch matchedBy;
    private String matchedAddress;

    @Builder
    private TicketRequester(String accountId, String name, String email, String directoryProvider,
                            TicketRequesterMatch matchedBy, String matchedAddress) {
        Assert.hasText(accountId, "accountId must not be blank");
        Assert.notNull(matchedBy, "matchedBy must not be null");
        Assert.hasText(matchedAddress, "matchedAddress must not be blank");
        this.accountId = accountId;
        this.name = name;
        this.email = email;
        this.directoryProvider = directoryProvider;
        this.matchedBy = matchedBy;
        this.matchedAddress = matchedAddress;
    }
}
