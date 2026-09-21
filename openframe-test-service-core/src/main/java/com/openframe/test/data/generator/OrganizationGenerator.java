package com.openframe.test.data.generator;

import com.openframe.test.data.dto.organization.AddressDto;
import com.openframe.test.data.dto.organization.ContactInformationDto;
import com.openframe.test.data.dto.organization.ContactPersonDto;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.OrganizationFilterInput;
import com.openframe.test.data.dto.organization.OrganizationSortInput;
import net.datafaker.Faker;

import java.time.LocalDate;
import java.util.List;


public class OrganizationGenerator {
    private static final Faker faker = new Faker();

    public static CreateOrganizationRequest createOrganizationRequest(boolean mailingAddressSameAsPhysical) {
        return CreateOrganizationRequest.builder()
                .name("Tech Solutions Inc")
                .category("Software Development")
                .numberOfEmployees(25)
                .websiteUrl("https://techsolutions.com")
                .monthlyRevenue("50000.00")
                .contractStartDate(LocalDate.now())
                .contractEndDate(LocalDate.now().plusYears(1))
                .contactInformation(contactInformation(mailingAddressSameAsPhysical))
                .notes("Premier client with annual contract")
                .build();
    }

    public static CreateOrganizationRequest updateOrganizationRequest(boolean mailingAddressSameAsPhysical) {
        return CreateOrganizationRequest.builder()
                .name("Tech Solutions Co")
                .category("Software Solutions")
                .numberOfEmployees(22)
                .websiteUrl("https://tech-solutions.com")
                .monthlyRevenue("55000.00")
                .contractStartDate(LocalDate.now().plusMonths(1))
                .contractEndDate(LocalDate.now().plusMonths(7))
                .contactInformation(contactInformation(mailingAddressSameAsPhysical))
                .notes("Premier client with semi-annual contract")
                .build();
    }

    public static OrganizationSortInput lastActivitySort(String direction) {
        return OrganizationSortInput.builder()
                .field("LAST_ACTIVITY")
                .direction(direction)
                .build();
    }

    public static OrganizationFilterInput lastActivityRangeFilter(String lastActivityFrom, String lastActivityTo) {
        return OrganizationFilterInput.builder()
                .lastActivityFrom(lastActivityFrom)
                .lastActivityTo(lastActivityTo)
                .build();
    }

    private static ContactInformationDto contactInformation(boolean mailingAddressSameAsPhysical) {
        AddressDto physicalAddress = address();
        ContactPersonDto contactPerson = contactPerson();
        ContactInformationDto.ContactInformationDtoBuilder builder = ContactInformationDto.builder()
                .physicalAddress(physicalAddress)
                .mailingAddressSameAsPhysical(mailingAddressSameAsPhysical)
                .contacts(List.of(contactPerson));
        if (!mailingAddressSameAsPhysical) {
            AddressDto mailingAddress = address();
            builder.mailingAddress(mailingAddress);
        }
        return builder.build();
    }

    private static AddressDto address() {
        String street1 = faker.address().streetAddress();
        String street2 = faker.address().secondaryAddress();
        String city = faker.address().city();
        String state = faker.address().state();
        String postalCode = faker.address().postcode();
        String country = faker.address().country();
        return AddressDto.builder()
                .street1(street1)
                .street2(street2)
                .city(city)
                .state(state)
                .postalCode(postalCode)
                .country(country)
                .build();
    }

    private static ContactPersonDto contactPerson() {
        String contactName = faker.name().fullName();
        String email = faker.internet().emailAddress();
        String phone = faker.phoneNumber().phoneNumber();
        return ContactPersonDto.builder()
                .contactName(contactName)
                .title("CEO")
                .email(email)
                .phone(phone)
                .build();
    }
}
