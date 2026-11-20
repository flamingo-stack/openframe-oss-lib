package com.openframe.data.document.ticket;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.springframework.util.Assert;

import java.time.Instant;
import java.util.List;

/**
 * Where an email ticket came from: the mailbox that received the email and who sent it.
 * The builder is the only write path and rejects a missing address; a stored document is read as it is.
 */
@Getter
@ToString
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketEmailOrigin {

    private String mailboxId;
    private String mailboxAddress;
    private String senderAddress;
    private List<String> cc;
    // Rule 3 of the inbound pipeline's Match: the normalised subject and the time of the latest email.
    private String subjectKey;
    private Instant lastEmailAt;

    @Builder
    private TicketEmailOrigin(String mailboxId, String mailboxAddress, String senderAddress, List<String> cc,
                              String subjectKey, Instant lastEmailAt) {
        Assert.hasText(mailboxAddress, "mailboxAddress must not be blank");
        Assert.hasText(senderAddress, "senderAddress must not be blank");
        this.mailboxId = mailboxId;
        this.mailboxAddress = mailboxAddress;
        this.senderAddress = senderAddress;
        this.cc = cc;
        this.subjectKey = subjectKey;
        this.lastEmailAt = lastEmailAt;
    }
}
