package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuditTargetRegistryTest {

    @Test
    void find_typeWithoutTarget_returnsAnEmptyList() {
        AuditTarget<Ticket> ticket = AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(ticket)));

        assertThat(targets.find(AuditTargetType.USER)).isEmpty();
    }

    @Test
    void find_targetsOfTwoProviders_returnsTheTargetOfEachProvider() {
        AuditTarget<Ticket> ticket = AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);
        AuditTarget<User> user = AuditTarget.of(AuditTargetType.USER, User.class, User::getEmail);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(ticket), () -> List.of(user)));

        assertThat(targets.find(AuditTargetType.TICKET)).containsExactly(ticket);
        assertThat(targets.find(AuditTargetType.USER)).containsExactly(user);
    }

    @Test
    void find_severalDocumentsOfOneType_returnsThemInRegistrationOrder() {
        AuditTarget<ScriptExecution> scripts =
                AuditTarget.of(AuditTargetType.EXECUTION, ScriptExecution.class, ScriptExecution::getExecutionId);
        AuditTarget<CommandExecution> commands =
                AuditTarget.of(AuditTargetType.EXECUTION, CommandExecution.class, CommandExecution::getExecutionId);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(scripts, commands)));

        assertThat(targets.find(AuditTargetType.EXECUTION)).containsExactly(scripts, commands);
    }

    @Test
    void constructor_twoTargetsOfOneTypeAndDocument_throwsNamingTypeAndDocument() {
        AuditTarget<Ticket> ticket = AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);

        assertThatThrownBy(() -> new AuditTargetRegistry(List.of(() -> List.of(ticket), () -> List.of(ticket))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Two audit targets for TICKET and Ticket");
    }

    @Test
    void constructor_oneDocumentClassUnderTwoTypes_keepsBoth() {
        AuditTarget<KnowledgeBaseItem> article =
                AuditTarget.of(AuditTargetType.KB_ARTICLE, KnowledgeBaseItem.class, KnowledgeBaseItem::getName);
        AuditTarget<KnowledgeBaseItem> folder =
                AuditTarget.of(AuditTargetType.KB_FOLDER, KnowledgeBaseItem.class, KnowledgeBaseItem::getName);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(article, folder)));

        assertThat(targets.find(AuditTargetType.KB_ARTICLE)).containsExactly(article);
        assertThat(targets.find(AuditTargetType.KB_FOLDER)).containsExactly(folder);
    }
}
