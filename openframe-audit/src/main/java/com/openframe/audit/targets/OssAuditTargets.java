package com.openframe.audit.targets;

import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.User;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Set;

import static com.openframe.data.document.audit.AuditTargetType.API_KEY;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;
import static com.openframe.data.document.audit.AuditTargetType.EXECUTION;
import static com.openframe.data.document.audit.AuditTargetType.IMAGE;
import static com.openframe.data.document.audit.AuditTargetType.INTEGRATED_TOOL;
import static com.openframe.data.document.audit.AuditTargetType.INVITATION;
import static com.openframe.data.document.audit.AuditTargetType.KB_ARTICLE;
import static com.openframe.data.document.audit.AuditTargetType.KB_FOLDER;
import static com.openframe.data.document.audit.AuditTargetType.OAUTH_CLIENT;
import static com.openframe.data.document.audit.AuditTargetType.ORGANIZATION;
import static com.openframe.data.document.audit.AuditTargetType.SCRIPT;
import static com.openframe.data.document.audit.AuditTargetType.SCRIPT_SCHEDULE;
import static com.openframe.data.document.audit.AuditTargetType.SOFTWARE_SCHEDULE;
import static com.openframe.data.document.audit.AuditTargetType.SSO_CONFIG;
import static com.openframe.data.document.audit.AuditTargetType.TAG;
import static com.openframe.data.document.audit.AuditTargetType.TENANT;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;
import static com.openframe.data.document.audit.AuditTargetType.TICKET_STATUS;
import static com.openframe.data.document.audit.AuditTargetType.TIME_ENTRY;
import static com.openframe.data.document.audit.AuditTargetType.USER;

@Component
public class OssAuditTargets implements AuditTargetProvider {

    @Override
    public List<AuditTarget<?>> targets() {
        return List.of(
                AuditTarget.of(TICKET, Ticket.class, Ticket::getTitle)
                        .withOrganizationId(Ticket::getOrganizationId)
                        .withDeviceId(Ticket::getDeviceId)
                        .withIgnoredFields(Set.of("lastActivityAt", "awaitingClientSince")),
                AuditTarget.of(DEVICE, Machine.class, OssAuditTargets::deviceName)
                        .withIdField("machineId")
                        .withOrganizationId(Machine::getOrganizationId)
                        .withDeviceId(Machine::getMachineId)
                        .withIgnoredFields(Set.of("lastSeen", "telemetryStatus", "packageManagers", "securityState",
                                "complianceState", "securityAlerts", "lastSecurityScan", "lastComplianceScan",
                                "stuckNotifiedAt")),
                AuditTarget.of(USER, User.class, User::nameOrEmail)
                        .withIgnoredFields(Set.of("crmSynced", "lastLogin"))
                        .withMaskedFields(Set.of("passwordHash")),
                AuditTarget.of(ORGANIZATION, Organization.class, Organization::getName)
                        .withIdField("organizationId")
                        .withOrganizationId(Organization::getOrganizationId),
                AuditTarget.of(TENANT, Tenant.class, Tenant::getName),
                AuditTarget.of(SCRIPT, Script.class, Script::getName)
                        .withMaskedFields(Set.of("scriptBody", "envVars")),
                AuditTarget.of(SCRIPT_SCHEDULE, ScheduleScript.class, ScheduleScript::getName)
                        .withMaskedFields(Set.of("scriptCustomParams")),
                AuditTarget.of(SOFTWARE_SCHEDULE, SoftwareSchedule.class, SoftwareSchedule::getName),
                AuditTarget.of(EXECUTION, ScriptExecution.class, ScriptExecution::getExecutionId)
                        .withDeviceId(ScriptExecution::getMachineId)
                        .withMaskedFields(Set.of("stdout", "stderr")),
                AuditTarget.of(EXECUTION, CommandExecution.class, CommandExecution::getExecutionId)
                        .withDeviceId(CommandExecution::getMachineId)
                        .withMaskedFields(Set.of("stdout", "stderr")),
                AuditTarget.of(TAG, Tag.class, Tag::getKey),
                AuditTarget.of(KB_ARTICLE, KnowledgeBaseItem.class, KnowledgeBaseItem::getName)
                        .withMaskedFields(Set.of("content")),
                AuditTarget.of(KB_FOLDER, KnowledgeBaseItem.class, KnowledgeBaseItem::getName),
                AuditTarget.of(IMAGE, KnowledgeBaseImage.class, KnowledgeBaseImage::getFileName),
                AuditTarget.of(TICKET_STATUS, TicketStatusDefinition.class, TicketStatusDefinition::getName),
                AuditTarget.of(TIME_ENTRY, TimeEntry.class, TimeEntry::getTicketTitle)
                        .withOrganizationId(TimeEntry::getOrganizationId),
                AuditTarget.of(API_KEY, ApiKey.class, ApiKey::getName)
                        .withMaskedFields(Set.of("hashedKey")),
                AuditTarget.of(INTEGRATED_TOOL, IntegratedTool.class, IntegratedTool::getName)
                        .withMaskedFields(Set.of("credentials")),
                AuditTarget.of(INVITATION, Invitation.class, Invitation::getEmail)
                        .withSecretId(true),
                AuditTarget.of(OAUTH_CLIENT, OAuthClient.class, OAuthClient::getClientId)
                        .withDeviceId(OAuthClient::getMachineId)
                        .withMaskedFields(Set.of("clientSecret")),
                AuditTarget.of(SSO_CONFIG, SSOConfig.class, SSOConfig::getProvider)
                        .withIdField("provider")
                        .withMaskedFields(Set.of("clientSecret")));
    }

    private static String deviceName(Machine machine) {
        return StringUtils.hasText(machine.getNickname()) ? machine.getNickname() : machine.getHostname();
    }
}
