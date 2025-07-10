
const translations = {
  en: {
    // General
    dashboard: 'Dashboard',
    schedule: 'Schedule',
    tasks: 'Tasks',
    events: 'Events',
    admin: 'Admin',
    platformAdmin: 'Platform Admin',
    tagline: 'Making famly life easier',
    signOut: 'Sign out',
    loading: 'Loading',
    errorLoadingData: 'Error loading data',
    comingSoon: 'Coming soon',
    featureInDevelopment: 'This feature is currently in development.',
    backToDashboard: 'Back to dashboard',
    cancel: 'Cancel',
    update: 'Update',
    create: 'Create',
    yesSoundsGood: 'Yes, sounds good',
    due: 'Due',
    rateLimitExceeded: 'Rate limit exceeded',
    tooManyRequests: 'Too many requests were made. Please wait a moment before trying again.',
    refreshPage: 'Refresh Page',
    goToHome: 'Go to Home',
    
    // Task filters
    allStatuses: 'All Statuses',
    allMembers: 'All Members',
    status: 'Status',
    assignee: 'Assignee',
    todo: 'To Do',
    in_progress: 'In Progress',
    completed: 'Completed',
    
    // AI Assistant
    aiAssistant: 'AI assistant',
    aiAssistantTitle: 'Your personal assistant',
    aiAssistantTagline: 'How can I simplify my famly life?',
    aiError: "Sorry, I had a little trouble with that. Could you try rephrasing?",
    actionCancelled: "Okay, I won't do that.",
    noFamilyIdError: "I can't do that without a famly context. Please set up or join a famly first.",
    taskCreatedConfirmation: 'Okay, I\'ve created the task: "{title}".',
    eventCreatedConfirmation: 'Okay, I\'ve scheduled the event: "{title}".',
    wishlistAddedConfirmation: 'Okay, I\'ve added "{name}" to the wishlist.',
    scheduleMyAppointment: 'Schedule my appointment for tomorrow',
    addToMyWishlist: 'Add a new game to my wishlist',
    createMyTasks: 'Create a task to clean my room',
    typeYourMessage: 'Type your message...',

    // Chat
    chats: 'Chats',
    activeNow: 'Active now',
    noConversationSelected: 'No conversation selected',
    selectConversationFromSidebar: 'Select a conversation from the sidebar to start chatting.',
    goToDashboard: 'Go to dashboard',
    
    // Schedule Page
    weekly: 'Weekly',
    byMember: 'By member',
    today: 'Today',
    filterByCategory: 'Filter by category',
    filterByDate: 'Filter by date',
    holiday: 'Holiday',
    studyday: 'Study Day',
    filterByMember: 'Filter by member',
    hideMembersFilter: 'Hide Members Filter',
    showMembersFilter: 'Show Members Filter',
    dashboardFavoriteSet: 'Dashboard favorite set',
    dashboardFavoriteRemoved: 'Dashboard favorite removed',
    dashboardUsesGeneralPreference: 'Dashboard will use your general preference',
    
    // Event Dialog
    editEvent: 'Edit event',
    addNewEvent: 'Add new event',
    recurring: 'Recurring',
    editRecurringEvent: 'Edit recurring event',
    editRecurringDescription: 'You are editing a recurring event. What would you like to do?',
    editThisEvent: 'Edit this event only',
    editAllEvents: 'Edit all events in series',
    eventTitle: 'Event title',
    enterEventTitle: 'Enter event title',
    description: 'Description',
    addEventDetails: 'Add event details...',
    startDateTime: 'Start date & time',
    selectDate: 'Select date',
    selectTime: 'Select time',
    selectHour: 'Select Hour',
    backToHours: 'Back to hours',
    endDateTime: 'End date & time',
    recurringEvent: 'Recurring event',
    selectRecurrence: 'Select recurrence',
    daily: 'Daily',
    monthly: 'Monthly',
    yearly: 'Yearly',
    assignToMembers: 'Assign to members',
    assignToDefault: 'Assign to (default: all)',
    membersSelected: '{count, plural, one {# member selected} other {# members selected}}',
    selectMembers: 'Select members',
    assignToAllHint: 'Leave empty to assign to all famly members.',
    category: 'Category',
    selectCategory: 'Select category',
    school: 'School',
    work: 'Work',
    sports: 'Sports',
    medical: 'Medical',
    social: 'Social',
    famly: 'Famly',
    other: 'Other',
    priority: 'Priority',
    selectPriority: 'Select priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    location: 'Location',
    enterLocation: 'Enter location',
    deleteEvent: 'Delete event',
    selectOption: 'Select option',
    processingFailed: 'Processing failed',
    unexpectedErrorOccurred: 'An unexpected error occurred. Please try again.',
    
    // Tasks Page
    createNewTask: 'Create new task',
    editTask: 'Edit task',
    taskPlaceholder: 'What needs to be done?',
    addDetails: 'Add details...',
    setDueDate: 'Set due date',
    recurringTask: 'Recurring task',
    estimatedDuration: 'Estimated duration (minutes)',
    points: 'Points',
    updateTask: 'Update task',
    createTask: 'Create task',
    allClear: 'All clear!',
    noTasksMatchFilters: 'No tasks match your current filters.',
    
    // Tasks status
    task: {
      createdTitle: 'Task Created',
      updatedTitle: 'Task Updated',
      deletedTitle: 'Task Deleted',
      statusUpdatedTitle: 'Status Updated',
      saveError: 'Failed to save task',
      deleteError: 'Failed to delete task',
      statusUpdateError: 'Failed to update status'
    },
    
    // Chat Actions
    confirmClearChat: 'Are you sure you want to delete all messages in this chat? This action cannot be undone.',
    chatCleared: 'Chat Cleared',
    allMessagesDeleted: 'All messages have been deleted.',
    couldNotClearChat: 'Could not clear chat messages.',
    notificationSettings: 'Notification Settings',
    chatSettings: 'Chat Settings',
    clearChat: 'Clear Chat',

    // Connectors Page
    connectors: 'Connectors',
    connectorsDescription: 'Connect your favorite apps and services to streamline your famly life.',
    activeConnectors: 'Active connectors',
    manageConnectors: 'Manage connectors',
    
    // Famly Setup
    createFamly: 'Create famly',
    joinFamly: 'Join famly',
    noFamlyFound: 'No famly found',
    checkWithAdmin: 'Please check with your famly administrator to make sure you have been invited.',
    inviteFamlyMembers: 'Invite famly members',

    // Dashboard
    weeklySchedule: 'Weekly schedule',
    upcomingEvents: 'Upcoming events',
    noUpcomingEvents: 'No upcoming events',
    viewFullSchedule: 'View full schedule',
    upcomingTasks: 'Upcoming tasks',
    noUpcomingTasks: 'No upcoming tasks',
    viewAllTasks: 'View all tasks',
    noDueDate: 'No due date',
    aiInsights: 'AI insights',
    funFact: 'Fun fact',
    defaultInsight: 'Consider scheduling some famly time together this week!',
    allFamly: 'All famly',

    // Tour
    tour_weeklySchedule_content: 'Get a quick overview of your famly\'s week at a glance. Click to navigate to the full schedule.',
    tour_upcomingEvents_content: 'Never miss an appointment or activity. Your next 5 events are listed here.',
    tour_upcomingTasks_content: 'Stay on top of your famly\'s to-do list. See what needs to be done.',
    tour_aiInsights_content: 'Our AI analyzes your schedule to provide helpful suggestions and optimizations.',
    tour_aiAssistant_content: 'Click here anytime to chat with the AI, create tasks, or schedule events using your voice.',
    
    // Tours
    tasksTour: {
      welcomeTitle: 'Welcome to Tasks',
      welcomeContent: 'This is where you manage all your famly\'s tasks and to-dos.',
      filterTitle: 'Filter Tasks',
      filterContent: 'Use these filters to focus on specific tasks by status or famly member.',
      nextMembersTitle: 'Next: Famly Members',
      nextMembersContent: 'Click here to manage your famly members and their profiles.'
    },

    // Member management
    manageMembers: 'Manage Members',
    familyMembers: 'Family Members',
    addMember: 'Add Member',
    editMember: 'Edit Member',
    editAIAssistant: 'Edit AI Assistant',
    memberName: 'Member name',
    dateOfBirth: 'Date of birth',
    role: 'Role',
    parent: 'Parent',
    teen: 'Teen',
    child: 'Child',
    profileColor: 'Profile color',
    language: 'Language',
    wishlistPassword: 'Wishlist password',
    optionalPassword: 'Optional password',
    wishlistPasswordHelper: 'Optional password to protect wishlist viewing',
    inviteByEmail: 'Invite by Email',
    emailAddress: 'Email address',
    enterEmailAddress: 'Enter email address',
    sendInvitation: 'Send Invitation',
    connected: 'Connected',
    invitationPending: 'Invitation Pending',
    localOnly: 'Local Only',
    chat: 'Chat',
    edit: 'Edit',
    delete: 'Delete',
    resendInvitation: 'Resend Invitation',
    wishlist: 'Wishlist',
    connectEmail: 'Connect Email',
    changeEmail: 'Change Email',
    connectEmailToMember: 'Connect Email to Member',
    connectEmailDescription: 'Send an invitation to connect this family member to an email address.',
    changeEmailAddress: 'Change Email Address',
    changeEmailDescription: 'Update the email address for this family member. A new invitation will be sent.',
    currentPendingEmail: 'Current pending email',
    newEmailAddress: 'New Email Address',
    enterNewEmailAddress: 'Enter new email address',
    updateInvitation: 'Update Invitation',
    changeConnectedEmail: 'Change Connected Email',
    changeConnectedEmailDescription: 'This will disconnect the current user and send a new invitation to the new email address. The old account will lose access to the family.',
    disconnectAndReinvite: 'Disconnect and Re-invite',
    confirmDisconnect: 'Are you sure? This will disconnect the current user from this profile and send an invitation to the new email. The old user account will lose access to this family.',
    invitationUpdated: 'Invitation updated',
    couldNotUpdateInvitation: 'Could not update invitation',
    
    confirmDeleteMember: 'Are you sure you want to delete this member?',
    memberDeleted: 'Member deleted',
    memberUpdated: 'Member updated',
    memberAdded: 'Member added',
    couldNotDeleteMember: 'Could not delete member',
    couldNotSaveMember: 'Could not save member',
    save: 'Save',
    cancel: 'Cancel',
    
    // Admin translations
    members: 'Members',
    invitations: 'Invitations',
    subscription: 'Subscription',
    settings: 'Settings',
    makeAdmin: 'Make Admin',
    memberPromoted: 'Member Promoted',
    isNowAdmin: 'is now a famly administrator',
    promotionFailed: 'Promotion Failed',
    couldNotPromoteMember: 'Could not promote member to admin',
    confirmDeleteInvitation: 'Are you sure you want to delete this invitation?',
    invitationDeleted: 'Invitation deleted',
    invitationRemoved: 'The invitation has been removed.',
    deleteFailed: 'Delete failed',
    couldNotDeleteInvitation: 'Could not delete invitation.',
    settingsUpdated: 'Settings Updated',
    updateFailed: 'Update Failed',
    popular: 'Popular',
    active: 'Active',
    currentPlanBtn: 'Current Plan',
    selectPlan: 'Select Plan',
    paymentFailed: 'Payment Failed',
    couldNotInitiatePayment: 'Could not initiate payment.',
    error: 'Error',
    
    // AI Assistant
    editAI: 'Edit AI',
    aiName: 'AI Name',
    aiNamePlaceholder: 'e.g., Alex, Jamie, Assistant',
    editName: 'Edit Name',
  },
  nl: {
    // General
    dashboard: 'Dashboard',
    schedule: 'Schema',
    tasks: 'Taken',
    events: 'Evenementen',
    admin: 'Beheer',
    platformAdmin: 'Platformbeheer',
    tagline: 'Het famlyleven makkelijker maken',
    signOut: 'Uitloggen',
    loading: 'Laden',
    errorLoadingData: 'Fout bij het laden van gegevens',
    comingSoon: 'Binnenkort beschikbaar',
    featureInDevelopment: 'Deze functie is momenteel in ontwikkeling.',
    backToDashboard: 'Terug naar dashboard',
    cancel: 'Annuleren',
    update: 'Bijwerken',
    create: 'Aanmaken',
    yesSoundsGood: 'Ja, klinkt goed',
    due: 'Verschuldigd',
    rateLimitExceeded: 'Frequentielimiet overschreden',
    tooManyRequests: 'Er zijn te veel verzoeken gedaan. Wacht een moment voordat je het opnieuw probeert.',
    refreshPage: 'Pagina vernieuwen',
    goToHome: 'Ga naar Start',

    // Task filters
    allStatuses: 'Alle statussen',
    allMembers: 'Alle leden',
    status: 'Status',
    assignee: 'Toegewezen aan',
    todo: 'Te doen',
    in_progress: 'Bezig',
    completed: 'Voltooid',

    // AI Assistant
    aiAssistant: 'AI-assistent',
    aiAssistantTitle: 'Je persoonlijke assistent',
    aiAssistantTagline: 'Hoe kan ik mijn famlyleven vereenvoudigen?',
    aiError: "Sorry, er ging iets mis. Kun je het anders formuleren?",
    actionCancelled: "Oké, ik zal het niet doen.",
    noFamilyIdError: "Ik kan dit niet doen zonder famlycontext. Maak eerst een famly aan of sluit je aan.",
    taskCreatedConfirmation: 'Oké, ik heb de taak aangemaakt: "{title}".',
    eventCreatedConfirmation: 'Oké, ik heb de afspraak ingepland: "{title}".',
    wishlistAddedConfirmation: 'Oké, ik heb "{name}" toegevoegd aan de verlanglijst.',
    scheduleMyAppointment: 'Plan mijn afspraak voor morgen in',
    addToMyWishlist: 'Voeg een nieuw spel toe aan mijn verlanglijst',
    createMyTasks: 'Maak een taak aan om mijn kamer op te ruimen',
    typeYourMessage: 'Typ je bericht...',

    // Chat
    chats: 'Chats',
    activeNow: 'Nu actief',
    noConversationSelected: 'Geen gesprek geselecteerd',
    selectConversationFromSidebar: 'Selecteer een gesprek in de zijbalk om te chatten.',
    goToDashboard: 'Ga naar dashboard',

    // Schedule Page
    weekly: 'Per week',
    byMember: 'Per lid',
    today: 'Vandaag',
    todaysEvents: 'Evenementen van vandaag',
    filterByCategory: 'Filter op categorie',
    filterByDate: 'Filter op datum',
    holiday: 'Vakantie',
    studyday: 'Studiedag',
    filterByMember: 'Filter op gezinslid',
    hideMembersFilter: 'Verberg ledenfilter',
    showMembersFilter: 'Toon ledenfilter',
    dashboardFavoriteSet: 'Dashboard favoriet ingesteld',
    dashboardFavoriteRemoved: 'Dashboard favoriet verwijderd',
    dashboardUsesGeneralPreference: 'Dashboard gebruikt nu je algemene voorkeur',

    // Event Dialog
    editEvent: 'Afspraak bewerken',
    addNewEvent: 'Nieuwe afspraak toevoegen',
    recurring: 'Herhalend',
    editRecurringEvent: 'Herhalende afspraak bewerken',
    editRecurringDescription: 'U bewerkt een herhalende afspraak. Wat wilt u doen?',
    editThisEvent: 'Alleen deze afspraak bewerken',
    editAllEvents: 'Alle afspraken in de reeks bewerken',
    eventTitle: 'Titel van afspraak',
    enterEventTitle: 'Voer de titel in',
    description: 'Beschrijving',
    addEventDetails: 'Voeg details toe...',
    startDateTime: 'Startdatum en -tijd',
    selectDate: 'Selecteer datum',
    selectTime: 'Selecteer tijd',
    selectHour: 'Selecteer uur',
    backToHours: 'Terug naar uren',
    endDateTime: 'Einddatum en -tijd',
    recurringEvent: 'Herhalende afspraak',
    selectRecurrence: 'Selecteer herhaling',
    daily: 'Dagelijks',
    monthly: 'Maandelijks',
    yearly: 'Jaarlijks',
    assignToMembers: 'Toewijzen aan leden',
    assignToDefault: 'Toewijzen aan (standaard: iedereen)',
    membersSelected: '{count, plural, one {# lid geselecteerd} other {# leden geselecteerd}}',
    selectMembers: 'Selecteer leden',
    assignToAllHint: 'Laat leeg om aan alle famlyleden toe te wijzen.',
    category: 'Categorie',
    selectCategory: 'Selecteer categorie',
    school: 'School',
    work: 'Werk',
    sports: 'Sport',
    medical: 'Medisch',
    social: 'Sociaal',
    famly: 'Famly',
    other: 'Overig',
    priority: 'Prioriteit',
    selectPriority: 'Selecteer prioriteit',
    low: 'Laag',
    medium: 'Gemiddeld',
    high: 'Hoog',
    location: 'Locatie',
    enterLocation: 'Voer locatie in',
    deleteEvent: 'Afspraak verwijderen',
    selectOption: 'Selecteer een optie',
    processingFailed: 'Verwerking mislukt',
    unexpectedErrorOccurred: 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.',

    // Tasks Page
    createNewTask: 'Nieuwe taak aanmaken',
    editTask: 'Taak bewerken',
    taskPlaceholder: 'Wat moet er gedaan worden?',
    addDetails: 'Voeg details toe...',
    setDueDate: 'Stel einddatum in',
    recurringTask: 'Herhalende taak',
    estimatedDuration: 'Geschatte duur (minuten)',
    points: 'Punten',
    updateTask: 'Taak bijwerken',
    createTask: 'Taak aanmaken',
    allClear: 'Alles is opgeruimd!',
    noTasksMatchFilters: 'Geen taken gevonden voor de huidige filters.',

    // Tasks status
    task: {
      createdTitle: 'Taak aangemaakt',
      updatedTitle: 'Taak bijgewerkt',
      deletedTitle: 'Taak verwijderd',
      statusUpdatedTitle: 'Status bijgewerkt',
      saveError: 'Kan taak niet opslaan',
      deleteError: 'Kan taak niet verwijderen',
      statusUpdateError: 'Kan status niet bijwerken'
    },

    // Chat Actions
    confirmClearChat: 'Weet je zeker dat je alle berichten in deze chat wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.',
    chatCleared: 'Chat gewist',
    allMessagesDeleted: 'Alle berichten zijn verwijderd.',
    couldNotClearChat: 'Kon chatberichten niet wissen.',
    notificationSettings: 'Notificatie-instellingen',
    chatSettings: 'Chat-instellingen',
    clearChat: 'Chat wissen',

    // Connectors Page
    connectors: 'Connectoren',
    connectorsDescription: 'Verbind je favoriete apps en diensten om je famlyleven te stroomlijnen.',
    activeConnectors: 'Actieve connectoren',
    manageConnectors: 'Beheer connectoren',

    // Famly Setup
    createFamly: 'Famly aanmaken',
    joinFamly: 'Aansluiten bij famly',
    noFamlyFound: 'Geen famly gevonden',
    checkWithAdmin: 'Vraag aan de beheerder van je famly of je bent uitgenodigd.',
    inviteFamlyMembers: 'Famlyleden uitnodigen',
    
    // Dashboard
    weeklySchedule: 'Wekelijks schema',
    upcomingEvents: 'Aankomende evenementen',
    noUpcomingEvents: 'Geen aankomende evenementen',
    viewFullSchedule: 'Bekijk volledig schema',
    upcomingTasks: 'Aankomende taken',
    noUpcomingTasks: 'Geen aankomende taken',
    viewAllTasks: 'Bekijk alle taken',
    noDueDate: 'Geen einddatum',
    aiInsights: 'AI-inzichten',
    funFact: 'Leuk weetje',
    defaultInsight: 'Overweeg om deze week wat quality time met de famly in te plannen!',
    allFamly: 'Hele famly',

    // Tour
    tour_weeklySchedule_content: 'Krijg een snel overzicht van de week van je famly. Klik om naar het volledige schema te navigeren.',
    tour_upcomingEvents_content: 'Mis nooit meer een afspraak of activiteit. Je volgende 5 evenementen staan hier vermeld.',
    tour_upcomingTasks_content: 'Blijf op de hoogte van de takenlijst van je famly. Zie wat er gedaan moet worden.',
    tour_aiInsights_content: 'Onze AI analyseert je schema en geeft nuttige suggesties en optimalisaties.',
    tour_aiAssistant_content: 'Klik hier op elk moment om met de AI te chatten, taken te maken of evenementen in te plannen met je stem.',
    
    // Tours
    tasksTour: {
      welcomeTitle: 'Welkom bij Taken',
      welcomeContent: 'Hier beheer je alle taken en to-dos van je famly.',
      filterTitle: 'Filter Taken',
      filterContent: 'Gebruik deze filters om te focussen op specifieke taken per status of famlylid.',
      nextMembersTitle: 'Volgende: Famlyleden',
      nextMembersContent: 'Klik hier om je famlyleden en hun profielen te beheren.'
    },
    
    // Member management
    manageMembers: 'Beheer Leden',
    familyMembers: 'Familieleden',
    addMember: 'Lid toevoegen',
    editMember: 'Lid bewerken',
    editAIAssistant: 'AI-assistent bewerken',
    memberName: 'Naam van lid',
    dateOfBirth: 'Geboortedatum',
    role: 'Rol',
    parent: 'Ouder',
    teen: 'Tiener',
    child: 'Kind',
    profileColor: 'Profielkleur',
    language: 'Taal',
    wishlistPassword: 'Verlanglijst wachtwoord',
    optionalPassword: 'Optioneel wachtwoord',
    wishlistPasswordHelper: 'Optioneel wachtwoord om verlanglijst te beschermen',
    inviteByEmail: 'Uitnodigen via e-mail',
    emailAddress: 'E-mailadres',
    enterEmailAddress: 'Voer e-mailadres in',
    sendInvitation: 'Uitnodiging versturen',
    connected: 'Verbonden',
    invitationPending: 'Uitnodiging in behandeling',
    localOnly: 'Alleen lokaal',
    chat: 'Chat',
    edit: 'Bewerken',
    delete: 'Verwijderen',
    resendInvitation: 'Uitnodiging opnieuw versturen',
    wishlist: 'Verlanglijst',
    connectEmail: 'E-mail koppelen',
    changeEmail: 'E-mail wijzigen',
    connectEmailToMember: 'E-mail koppelen aan lid',
    connectEmailDescription: 'Stuur een uitnodiging om dit familielid te koppelen aan een e-mailadres.',
    changeEmailAddress: 'E-mailadres wijzigen',
    changeEmailDescription: 'Werk het e-mailadres voor dit familielid bij. Er wordt een nieuwe uitnodiging verzonden.',
    currentPendingEmail: 'Huidig e-mailadres in behandeling',
    newEmailAddress: 'Nieuw e-mailadres',
    enterNewEmailAddress: 'Voer nieuw e-mailadres in',
    updateInvitation: 'Uitnodiging bijwerken',
    changeConnectedEmail: 'Verbonden e-mail wijzigen',
    changeConnectedEmailDescription: 'Dit zal de huidige gebruiker loskoppelen en een nieuwe uitnodiging naar het nieuwe e-mailadres sturen. Het oude account verliest de toegang tot de familie.',
    disconnectAndReinvite: 'Loskoppelen en opnieuw uitnodigen',
    confirmDisconnect: 'Weet u het zeker? Dit koppelt de huidige gebruiker los van dit profiel en stuurt een uitnodiging naar de nieuwe e-mail. Het oude gebruikersaccount verliest de toegang tot deze familie.',
    invitationUpdated: 'Uitnodiging bijgewerkt',
    couldNotUpdateInvitation: 'Kon uitnodiging niet bijwerken',

    confirmDeleteMember: 'Weet je zeker dat je dit lid wilt verwijderen?',
    memberDeleted: 'Lid verwijderd',
    memberUpdated: 'Lid bijgewerkt',
    memberAdded: 'Lid toegevoegd',
    couldNotDeleteMember: 'Kon lid niet verwijderen',
    couldNotSaveMember: 'Kon lid niet opslaan',
    save: 'Opslaan',
    cancel: 'Annuleren',
    
    // Admin translations
    members: 'Leden',
    invitations: 'Uitnodigingen',
    subscription: 'Abonnement',
    settings: 'Instellingen',
    makeAdmin: 'Beheerder maken',
    memberPromoted: 'Lid bevorderd',
    isNowAdmin: 'is nu een famly beheerder',
    promotionFailed: 'Bevordering mislukt',
    couldNotPromoteMember: 'Kon lid niet bevorderen tot beheerder',
    confirmDeleteInvitation: 'Weet je zeker dat je deze uitnodiging wilt verwijderen?',
    invitationDeleted: 'Uitnodiging verwijderd',
    invitationRemoved: 'De uitnodiging is verwijderd.',
    deleteFailed: 'Verwijderen mislukt',
    couldNotDeleteInvitation: 'Kon uitnodiging niet verwijderen.',
    settingsUpdated: 'Instellingen bijgewerkt',
    updateFailed: 'Bijwerken mislukt',
    popular: 'Populair',
    active: 'Actief',
    currentPlanBtn: 'Huidig abonnement',
    selectPlan: 'Abonnement kiezen',
    paymentFailed: 'Betaling mislukt',
    couldNotInitiatePayment: 'Kon betaling niet initiëren.',
    error: 'Fout',
    
    // AI Assistant
    editAI: 'AI bewerken',
    aiName: 'AI-naam',
    aiNamePlaceholder: 'bijv. Alex, Jamie, Assistent',
    editName: 'Naam bewerken',
  },
  es: {
    // Admin page translations
    familyAdmin: 'Administración Familiar',
    manageFamilySettings: 'Gestiona la configuración y miembros de tu familia.',
    familyMembers: 'Miembros de la Familia',
    inviteNewMember: 'Invitar Nuevo Miembro',
    enterEmailAddress: 'Ingresa dirección de correo',
    sendInvitation: 'Enviar Invitación',
    sending: 'Enviando...',
    pendingInvitations: 'Invitaciones Pendientes',
    invitedBy: 'Invitado por',
    currentPlan: 'Plan Actual',
    currentPlanBtn: 'Plan Actual',
    selectPlan: 'Seleccionar Plan',
    familySettings: 'Configuración Familiar',
    familyName: 'Nombre de la Familia',
    enterFamilyName: 'Ingresa nombre de familia',
    defaultLanguage: 'Idioma Predeterminado',
    connected: 'Conectado',
    invitationSent: 'Invitación enviada',
    invitationFailed: 'Invitación fallida',
    couldNotSendInvitation: 'No se pudo enviar la invitación. Inténtalo de nuevo.',
    familySettingsSaved: 'La configuración familiar se ha guardado.',
    couldNotUpdateSettings: 'No se pudo actualizar la configuración.',
    famlyIdDisplay: 'Famly ID',
    // Member dialog translations
    editAI: 'Editar IA',
    aiName: 'Nombre de IA',
    aiNamePlaceholder: 'ej. Alex, Jamie, Asistente',
    editName: 'Editar Nombre',
    // Schedule sidebar translations
    todaysEvents: "Eventos de hoy",
    noEventsToday: 'No hay eventos para hoy.',
    // Task related translations  
    taskTitle: 'Título de tarea'
  },
  fr: {
    // Admin page translations
    familyAdmin: 'Administration Familiale',
    manageFamilySettings: 'Gérez les paramètres et les membres de votre famille.',
    familyMembers: 'Membres de la Famille',
    inviteNewMember: 'Inviter un Nouveau Membre',
    enterEmailAddress: 'Entrez l\'adresse email',
    sendInvitation: 'Envoyer l\'Invitation',
    sending: 'Envoi en cours...',
    pendingInvitations: 'Invitations en Attente',
    invitedBy: 'Invité par',
    currentPlan: 'Plan Actuel',
    currentPlanBtn: 'Plan Actuel',
    selectPlan: 'Sélectionner le Plan',
    familySettings: 'Paramètres Familiaux',
    familyName: 'Nom de Famille',
    enterFamilyName: 'Entrez le nom de famille',
    defaultLanguage: 'Langue par Défaut',
    connected: 'Connecté',
    invitationSent: 'Invitation envoyée',
    invitationFailed: 'Invitation échouée',
    couldNotSendInvitation: 'Impossible d\'envoyer l\'invitation. Veuillez réessayer.',
    familySettingsSaved: 'Les paramètres familiaux ont été sauvegardés.',
    couldNotUpdateSettings: 'Impossible de mettre à jour les paramètres.',
    famlyIdDisplay: 'Famly ID',
    // Member dialog translations
    editAI: 'Modifier l\'IA',
    aiName: 'Nom de l\'IA',
    aiNamePlaceholder: 'ex. Alex, Jamie, Assistant',
    editName: 'Modifier le Nom',
    // Schedule sidebar translations
    todaysEvents: "Événements d'aujourd'hui",
    noEventsToday: 'Aucun événement pour aujourd\'hui.',
    // Task related translations  
    taskTitle: 'Titre de la tâche'
  },
  de: {
    // Admin page translations
    familyAdmin: 'Familienverwaltung',
    manageFamilySettings: 'Verwalten Sie Ihre Familieneinstellungen und -mitglieder.',
    familyMembers: 'Familienmitglieder',
    inviteNewMember: 'Neues Mitglied einladen',
    enterEmailAddress: 'E-Mail-Adresse eingeben',
    sendInvitation: 'Einladung senden',
    sending: 'Senden...',
    pendingInvitations: 'Ausstehende Einladungen',
    invitedBy: 'Eingeladen von',
    currentPlan: 'Aktueller Plan',
    currentPlanBtn: 'Aktueller Plan',
    selectPlan: 'Plan auswählen',
    familySettings: 'Familieneinstellungen',
    familyName: 'Familienname',
    enterFamilyName: 'Familienname eingeben',
    defaultLanguage: 'Standardsprache',
    connected: 'Verbunden',
    invitationSent: 'Einladung gesendet',
    invitationFailed: 'Einladung fehlgeschlagen',
    couldNotSendInvitation: 'Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
    familySettingsSaved: 'Familieneinstellungen wurden gespeichert.',
    couldNotUpdateSettings: 'Einstellungen konnten nicht aktualisiert werden.',
    famlyIdDisplay: 'Famly ID',
    // Member dialog translations
    editAI: 'KI bearbeiten',
    aiName: 'KI-Name',
    aiNamePlaceholder: 'z.B. Alex, Jamie, Assistent',
    editName: 'Name bearbeiten',
    // Schedule sidebar translations
    todaysEvents: "Heutige Termine",
    noEventsToday: 'Keine Termine für heute.',
    // Task related translations  
    taskTitle: 'Aufgabentitel'
  }
};

export const getTranslation = (key, lang = 'en', options = {}) => {
  const langTranslations = translations[lang] || translations.en;
  let text = langTranslations[key];

  // If key is a path (e.g., 'task.createdTitle')
  if (typeof text === 'undefined' && key && typeof key === 'string' && key.includes('.')) {
    const path = key.split('.');
    let current = langTranslations;
    for (let i = 0; i < path.length; i++) {
      if (current && typeof current === 'object' && path[i] in current) {
        current = current[path[i]];
      } else {
        current = undefined; // Path not found
        break;
      }
    }
    text = current;
  }
  
  // Ensure text is always a string, fallback to key if translation not found
  text = (typeof text === 'string' ? text : String(key || ''));

  // Handle pluralization - only if we have valid options.count
  if (typeof options.count !== 'undefined' && options.count !== null) {
    const pluralRules = new Intl.PluralRules(lang);
    const pluralCategory = pluralRules.select(options.count);
    const pluralKey = `${key}_${pluralCategory}`;
    const pluralText = langTranslations[pluralKey];
    if (typeof pluralText === 'string') {
      text = pluralText;
    }
  }

  // Handle interpolation - only process if text is valid and options exist
  if (text && typeof text === 'string' && options && typeof options === 'object') {
    Object.keys(options).forEach(optionKey => {
      if (optionKey !== 'count' && options[optionKey] != null) {
        const regex = new RegExp(`{${optionKey}}`, 'g');
        text = text.replace(regex, String(options[optionKey]));
      }
    });
  }
  
  return text;
};

export const getLanguageInfo = (lang) => {
  switch (lang) {
    case 'en': return { name: 'English', flag: '🇬🇧' };
    case 'nl': return { name: 'Nederlands', flag: '🇳🇱' };
    case 'es': return { name: 'Español', flag: '🇪🇸' };
    case 'fr': return { name: 'Français', flag: '🇫🇷' };
    case 'de': return { name: 'Deutsch', flag: '🇩🇪' };
    case 'it': return { name: 'Italiano', flag: '🇮🇹' };
    case 'pt': return { name: 'Português', flag: '🇵🇹' };
    default: return { name: 'English', flag: '🇬🇧' };
  }
};
