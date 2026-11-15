export type Language = 'en' | 'ar';

export interface Translations {
  // Navigation & Brand
  brand: string;
  tagline: string;
  navHome: string;
  navMarkets: string;
  navAnalysis: string;
  navJournal: string;
  navNews: string;
  navGiveaways: string;
  navCompetitions: string;
  navBrokers: string;
  navContact: string;
  navMore: string;
  navMenuLabel: string;
  signIn: string;
  signOut: string;
  signedInLabel: string;
  adminBadge: string;
  deleteAccount: string;
  deleteConfirm: string;
  deleteSuccess: string;
  deletingBtn: string;
  cancelBtn: string;
  closeBtn: string;
  themeToggle: string;
  langToggle: string;
  loadingPage: string;

  // Auth Modal (Email + Password + Forgot Password)
  createAccountTitle: string;
  forgotPasswordTitle: string;
  forgotPasswordDesc: string;
  forgotPasswordLink: string;
  sendResetLink: string;
  sendingLabel: string;
  resetEmailSent: string;
  backToSignIn: string;
  emailAddressLabel: string;
  passwordLabel: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  createAccountBtn: string;
  signUpSuccessMsg: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  authErrorGeneric: string;

  // Home Page
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  exploreMarkets: string;
  openJournal: string;
  statsTitle: string;
  liveFeedsFeature: string;
  liveFeedsDesc: string;
  mt5JournalFeature: string;
  mt5JournalDesc: string;
  aiNewsFeature: string;
  aiNewsDesc: string;
  brokerPartnershipFeature: string;
  brokerPartnershipDesc: string;
  educationalNoticeLabel: string;

  // Status labels
  statusLive: string;
  statusDelayed: string;
  statusStale: string;
  statusMarketClosed: string;
  statusDisconnected: string;
  statusUnavailable: string;
  statusSync: string;
  notAvailableShort: string;

  // Markets & Terminal Page
  marketsTitle: string;
  marketsSubtitle: string;
  timeframe: string;
  lastUpdated: string;
  livePrice: string;
  change24h: string;
  high24h: string;
  low24h: string;
  bias: string;
  bullish: string;
  bearish: string;
  neutral: string;
  confidence: string;
  keyLevels: string;
  support: string;
  resistance: string;
  pivot: string;
  technicalSummary: string;
  trendStructure: string;
  indicatorsOverview: string;
  educationalDisclaimer: string;
  errorLoadingData: string;
  retry: string;
  instrumentSelectorAria: string;
  bidLabel: string;
  askLabel: string;
  spreadLabel: string;
  chartToolsBtn: string;
  chartEngineLabel: string;
  chartEngineTradingView: string;
  chartEngineQuant: string;
  candleStyleLabel: string;
  candleStyleCandles: string;
  candleStyleHollow: string;
  candleStyleHeikin: string;
  candleStyleLine: string;
  drawingToolbarLabel: string;
  emaOverlayLabel: string;
  smcOverlayLabel: string;
  expandChartTitle: string;
  showSidebarTitle: string;
  watchlistLabel: string;
  marketsCountLabel: string;
  dailyBiasQuantTitle: string;
  alignLabel: string;
  sessionLabel: string;
  refLabel: string;
  calculatingDailyBias: string;
  openFullDailyAnalysis: string;
  instrumentDataFeedTitle: string;
  assetLabel: string;
  contractLevLabel: string;
  quoteSourceLabel: string;
  candleFeedLabel: string;
  lastUpdateLabel: string;
  degradedFeedNotice: string;
  lastVerifiedPrefix: string;
  tvFeedProvenanceNote: string;
  tvChartProvenanceBadge: string;
  backendChartProvenanceBadge: string;
  noCandlesAvailable: string;
  tabPositions: string;
  tabPending: string;
  tabHistory: string;
  tabSmcZones: string;
  floatingLabel: string;
  newOrderBtn: string;
  signInPaperTerminal: string;
  collapseBlotter: string;
  expandBlotter: string;
  signInPositionsPrompt: string;
  signInHistoryPrompt: string;
  noPendingTitle: string;
  noPendingDesc: string;
  insufficientSmcBars: string;
  quickOrderTitle: string;
  executesAtServerQuote: string;
  liveExecPriceLabel: string;
  riskPctShort: string;
  lotsUnit: string;
  marginShort: string;
  orderNotePlaceholder: string;
  executingLabel: string;
  orderBlocksLabel: string;
  fvgsLabel: string;
  liquidityPoolsLabel: string;
  latestBosChochLabel: string;
  activeCountSuffix: string;
  mappedCountSuffix: string;
  noneLabel: string;
  support1Label: string;
  resistance1Label: string;

  // Analysis Page
  analysisTitle: string;
  analysisSubtitle: string;
  archivedDateAria: string;
  todayNyTag: string;
  archivedTag: string;
  checkIntradayBtn: string;
  schedulerBtn: string;
  chartTerminalBtn: string;
  schedulerAuditTitle: string;
  archivedTodaySuffix: string;
  pendingStatus: string;
  checksSuffix: string;
  colTime: string;
  colJob: string;
  colSymbol: string;
  colDate: string;
  colStatus: string;
  computingAnalysisMsg: string;
  nyDatePrefix: string;
  snapshotTimePrefix: string;
  dataQualityPrefix: string;
  snapshotPricePrefix: string;
  livePrefix: string;
  bullishScoreLabel: string;
  bearishScoreLabel: string;
  alignmentScoreLabel: string;
  alignmentTooltip: string;
  conflictsBannerTitle: string;
  colScoringComponent: string;
  colWeight: string;
  colRawScore: string;
  colContribution: string;
  colEvidence: string;
  historicalEvalTitle: string;
  intradayTimelineTitle: string;
  immutableSnapshotNote: string;
  mtfMatrixTitle: string;
  colTf: string;
  colBars: string;
  colRegime: string;
  colLean: string;
  colScore: string;
  colLatestEvent: string;
  colEmaStack: string;
  colDealingZone: string;
  liquidityAndSrTitle: string;
  bslResistanceTitle: string;
  sslSupportTitle: string;
  detectedSweepsTitle: string;
  obFvgRangeTitle: string;
  activeOrderBlocksLabel: string;
  noOrderBlocksMsg: string;
  unfilledFvgLabel: string;
  noFvgMsg: string;
  bullishScenarioTitle: string;
  bearishScenarioTitle: string;
  targetsLabel: string;
  invalidationVolTitle: string;
  volatilityLabel: string;
  dailyAtrLabel: string;
  volumeLabel: string;
  quantInterpreterTitle: string;
  explainedByModelPrefix: string;
  deterministicOnlyLabel: string;
  marketStructureOverview: string;
  deterministicEvidenceLabel: string;
  bullishPathLabel: string;
  bearishPathLabel: string;
  conflictsInvalidationLabel: string;
  conclusionLabel: string;
  matchedNewsContextTitle: string;
  alignmentNoteFooter: string;
  insufficientDataBadge: string;
  validBadge: string;
  weakeningBadge: string;
  invalidatedBadge: string;

  // Trading Journal
  journalTitle: string;
  journalSubtitle: string;
  serverValidatedBadge: string;
  loginRequired: string;
  loginRequiredDesc: string;
  startingCapital: string;
  setCapital: string;
  saveCapital: string;
  savingLabel: string;
  capitalRangeHelp: string;
  capitalRangeError: string;
  balance: string;
  equity: string;
  floatingPnl: string;
  freeMargin: string;
  initialCapitalPrefix: string;
  balancePlusFloating: string;
  includesCommSwap: string;
  marginUsedPrefix: string;
  activePositionsPrefix: string;
  newTrade: string;
  symbol: string;
  side: string;
  buy: string;
  sell: string;
  buyShort: string;
  sellShort: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskPct: string;
  lotSize: string;
  contractSize: string;
  openTradeBtn: string;
  invalidSlTpBuy: string;
  invalidSlTpSell: string;
  openTrades: string;
  noOpenTrades: string;
  manualClose: string;
  tradeHistory: string;
  noClosedTrades: string;
  winRate: string;
  totalProfit: string;
  totalLoss: string;
  netPnl: string;
  profitFactor: string;
  avgRR: string;
  bestTrade: string;
  worstTrade: string;
  equityCurve: string;
  pointsCountSuffix: string;
  closeOneTradePrompt: string;
  filterSymbol: string;
  filterAll: string;
  resetBtn: string;
  closeReason: string;
  openedAt: string;
  closedAt: string;
  autoClosedHitSL: string;
  autoClosedHitTP: string;
  colLots: string;
  colEntry: string;
  colLiveQuote: string;
  colExit: string;
  colCommSwap: string;
  colNetPnlUsd: string;
  colAction: string;
  colTrigger: string;
  feedWaitLabel: string;
  serverExecNotice: string;
  execQuoteLabel: string;
  feedOfflineLabel: string;
  marginEstPrefix: string;
  maxRiskPrefix: string;
  strategyNotesLabel: string;
  strategyNotesPlaceholder: string;

  // News Page
  newsTitle: string;
  newsSubtitle: string;
  tabToday: string;
  tabOldNews: string;
  filterMarkets: string;
  expectedImpact: string;
  aiAnalysisExplanation: string;
  readSource: string;
  headlineArchive: string;
  whatHappened: string;
  howItAffected: string;
  clickToExpand: string;
  verifiedProvidersPrefix: string;
  verifiedFinancialWire: string;
  officialArchivesPrefix: string;
  loadingVerifiedWire: string;
  loadingArchivesMsg: string;
  noNewsMsg: string;
  noArchiveMsg: string;
  macroAssetImpactTitle: string;
  analyzeWithGeminiBtn: string;
  reanalyzeSelectedBtn: string;
  analyzingBtn: string;

  // Giveaways (YOUNEEL GIVEAWAYS)
  giveawaysTitle: string;
  giveawaysSubtitle: string;
  prizePool: string;
  rules: string;
  enterNow: string;
  signInToParticipate: string;
  statusActive: string;
  statusEnded: string;
  publicViewBtn: string;
  adminConsoleBtn: string;
  newGiveawayBtn: string;
  giveawaysUnavailableTitle: string;
  giveawaysUnavailableDesc: string;
  giveawaysUnavailableAdminDesc: string;
  noGiveawaysCreated: string;
  noPublishedGiveawaysTitle: string;
  noPublishedGiveawaysDesc: string;
  loadingGiveaways: string;
  statusDraft: string;
  publishedTag: string;
  unpublishedTag: string;
  endsPrefix: string;
  entriesPrefix: string;
  winnerAnnouncedPrefix: string;
  winnerPrefix: string;
  participantsBtn: string;
  publishBtn: string;
  unpublishBtn: string;
  startBtn: string;
  endBtn: string;
  editLabel: string;
  deleteLabel: string;
  confirmBtn: string;
  enteredStatusPrefix: string;
  participationRecorded: string;
  giveawayCreatedMsg: string;
  giveawayUpdatedMsg: string;
  giveawayDeletedMsg: string;
  enterGiveawayHeading: string;
  submittingAsPrefix: string;
  verificationNoteLabel: string;
  verificationNotePlaceholder: string;
  submittingBtn: string;
  confirmEntryBtn: string;
  editGiveawayTitle: string;
  createGiveawayTitle: string;
  fieldTitleRequired: string;
  fieldPrizeRequired: string;
  fieldDescription: string;
  fieldRules: string;
  fieldImageUrl: string;
  fieldStartsAt: string;
  fieldEndsAtRequired: string;
  fieldStatus: string;
  optionDraft: string;
  optionActive: string;
  optionEnded: string;
  publishToPublicLabel: string;
  saveGiveawayBtn: string;
  participantsModalHeading: string;
  noEntriesSubmittedYet: string;
  approveTitle: string;
  rejectTitle: string;
  selectWinnerBtn: string;

  // Brokers
  brokersTitle: string;
  brokersSubtitle: string;
  verifiedBrokerBadge: string;
  openLiveAccount: string;
  hfmTagline: string;
  hfmBadge: string;
  hfmDescription: string;
  hfmFeatures: string[];
  tmgmTagline: string;
  tmgmBadge: string;
  tmgmDescription: string;
  tmgmFeatures: string[];
  affiliateDisclosure: string;
  riskWarning: string;

  // Contact
  contactTitle: string;
  contactSubtitle: string;
  connectInstagramHeading: string;
  instagramNotice: string;
  instagramBtn: string;
  telegramBtn: string;
  followHandleAria: string;
  dailyBreakdownsBadge: string;
  giveawayAlertsBadge: string;
  directInquiriesTitle: string;
  directInquiriesDesc: string;

  // Legal & Proprietary Protection
  institutionalBadge: string;
  privacyPolicy: string;
  termsOfService: string;
  allRightsReserved: string;
  paperTradingNote: string;
  privacyClause1Title: string;
  privacyClause1Body: string;
  privacyClause2Title: string;
  privacyClause2Body: string;
  privacyClause3Title: string;
  privacyClause3Body: string;
  privacyClause4Title: string;
  privacyClause4Body: string;
  termsClause1Title: string;
  termsClause1Body: string;
  termsClause2Title: string;
  termsClause2Body: string;
  termsClause3Title: string;
  termsClause3Body: string;
  termsClause4Title: string;
  termsClause4Body: string;
  proprietaryBadge: string;
  copyNoticeToast: string;

  // Featured & Broker Competitions
  ownerStudioLabel: string;
  featuredCompetitionsTitle: string;
  featuredCompetitionsDesc: string;
  viewAllCompetitionsBtn: string;
  competitionsTitle: string;
  competitionsSubtitle: string;
  allBrokersFilter: string;
  allStatusesFilter: string;
  searchCompetitionsPlaceholder: string;
  noCompetitionsTitle: string;
  noCompetitionsDesc: string;
  officialBrokerContest: string;
  accountsLabel: string;
  verifiedPrefix: string;
  compPotentiallyOutdatedNotice: string;
  compRegDeadlineLabel: string;
  compDatesLabel: string;
  compEligibilityLabel: string;
  compRequirementsLabel: string;
  participateOfficialBtn: string;
  officialSourceLinkLabel: string;
  officialRulesLabel: string;
  compStatusLive: string;
  compStatusRegOpen: string;
  compStatusUpcoming: string;
  compStatusEndingSoon: string;
  compStatusCompleted: string;
  compStatusExpired: string;
  compStatusUnverified: string;
  brokerSourcesNote: string;

  // Extended Giveaway Builder & Media Cropper
  statusPaused: string;
  statusScheduled: string;
  statusArchived: string;
  previewPlaceholderTitle: string;
  previewPlaceholderPrize: string;
  mediaUploadHeading: string;
  dragToReposition: string;
  selectImageFromComputer: string;
  chooseImageFileBtn: string;
  cropAndUploadBtn: string;
  uploadingImageLabel: string;
  imageUploadedSuccess: string;
  uploadMimeError: string;
  uploadSizeError: string;
  uploadFailedFallback: string;

  // Private Owner Mode
  ownerStudioTitle: string;
  ownerStudioSubtitle: string;
  ownerGateTitle: string;
  ownerGateDesc: string;
  ownerOtpHeading: string;
  ownerOtpDesc: string;
  ownerOtpPlaceholder: string;
  requestOtpBtn: string;
  verifyOtpBtn: string;
  verifyingOtpBtn: string;
  resendOtpBtn: string;
  otpSentNotice: string;
  otpDeliveryMissingTitle: string;
  otpDeliveryMissingDesc: string;
  unauthorizedOwnerTitle: string;
  unauthorizedOwnerDesc: string;
  returnHomeBtn: string;
  lockOwnerSessionBtn: string;
  ownerTabGiveaways: string;
  ownerTabCompetitions: string;
  ownerTabSecurity: string;
  builderTabContent: string;
  builderTabDesign: string;
  builderTabMedia: string;
  builderTabSchedule: string;
  builderLivePreview: string;
  saveDraftBtn: string;
  publishNowBtn: string;
  scheduleBtn: string;
  duplicateBtn: string;
  pauseBtn: string;
  archiveBtn: string;
  unarchiveBtn: string;
  fieldSubtitle: string;
  fieldCtaLabel: string;
  fieldExternalUrl: string;
  fieldPublishAt: string;
  designTemplateLabel: string;
  colorBgLabel: string;
  colorSurfaceLabel: string;
  colorAccentLabel: string;
  colorTextLabel: string;
  fontPresetLabel: string;
  cornerRadiusLabel: string;
  fontSansLabel: string;
  fontSerifLabel: string;
  fontCondensedLabel: string;
  fontArabicLabel: string;
  compQueueHeading: string;
  compAllHeading: string;
  compAddManualBtn: string;
  compSyncNowBtn: string;
  compSyncingBtn: string;
  compApprovePublishBtn: string;
  compRejectBtn: string;
  compFeatureHomeBtn: string;
  compUnfeatureHomeBtn: string;
  compAddBrokerBtn: string;
  discoveryLogsHeading: string;
  notificationsHeading: string;
  markAllReadBtn: string;
  auditLogsHeading: string;
  schedulerStatusHeading: string;
  emailDeliveryHeading: string;
  compBrokerLabel: string;
  compPrizePoolLabel: string;
  compPrizeDetailsLabel: string;
  compOfficialSourceLabel: string;
  compOfficialRegLabel: string;
  compRulesUrlLabel: string;
  compRegStartLabel: string;
  compRegEndLabel: string;
  compStartLabel: string;
  compEndLabel: string;
  compEligibilityInputLabel: string;
  compTradingReqInputLabel: string;
  compStatusInputLabel: string;
  saveCompetitionBtn: string;
  brokerSlugPlaceholder: string;
  brokerNamePlaceholder: string;
  brokerSitePlaceholder: string;
  brokerSourcePlaceholder: string;
  ownerDiagHeading: string;
  ownerDiagSubtitle: string;
  diagSupabaseAuth: string;
  diagUserId: string;
  diagOwnerRole: string;
  diagEmailVerify: string;
  diagEmailDelivery: string;
  diagSessionValid: string;
  diagAuthResult: string;
  ownerProvisionToggle: string;
  ownerProvisionBackToSignIn: string;
  ownerProvisionBtn: string;
  ownerProvisionDesc: string;
  ownerResendCooldownPrefix: string;
  refreshBtn: string;

  // Extended Giveaway Cards, Diagnostics, Journal, Brokers, Contact, Home & Owner Tabs
  giveawaySponsorLabel: string;
  entriesSuffix: string;
  giveawayEligibilityLabel: string;
  giveawayCountryRestrictionsLabel: string;
  giveawayCapacityFull: string;
  giveawayMaxParticipantsLabel: string;
  giveawayDiagnosticsTitle: string;
  diagTablesLabel: string;
  diagPermissionsLabel: string;
  diagStorageLabel: string;
  diagAuthLabel: string;
  diagOtherDbLabel: string;
  diagSqlActionPrompt: string;
  markCompletedBtn: string;
  giveawaysGroupActive: string;
  giveawaysGroupUpcoming: string;
  giveawaysGroupCompleted: string;
  giveawaysSchemaMissingTitle: string;

  brokerSpecsHeading: string;
  brokerFactVerified: string;
  brokerFactConfirm: string;

  contactSuccessMsg: string;
  contactNameLabel: string;
  contactNamePlaceholder: string;
  contactSubjectLabel: string;
  contactSubjectPlaceholder: string;
  contactMessageLabel: string;
  contactMessagePlaceholder: string;
  contactSendBtn: string;

  homeDailyBiasHeading: string;
  viewAllGiveawaysBtn: string;
  homeLatestNewsHeading: string;
  homeNewsUnavailableNotice: string;

  maxDrawdownLabel: string;
  journalSearchPlaceholder: string;
  journalStrategyLabel: string;
  allStrategiesFilter: string;
  journalEmotionsLabel: string;
  journalEntryReasonLabel: string;
  journalExitReasonLabel: string;
  journalMistakesLabel: string;
  journalScreenshotLabel: string;
  editJournalTitle: string;
  saveJournalBtn: string;

  ownerTabOverview: string;
  ownerTabUsers: string;
  ownerOverviewHeading: string;
  metricUsersLabel: string;
  metricTradesLabel: string;
  metricGiveawaysLabel: string;
  metricParticipantsLabel: string;
  metricCompetitionsLabel: string;
  metricInquiriesLabel: string;
  ownerUsersHeading: string;
  setTraderRoleBtn: string;
  setAdminRoleBtn: string;
  ownerInquiriesHeading: string;
  noInquiriesYet: string;

  brokerOfficialDomain: string;
  brokerVerifyDirectNote: string;

  tabMacroEvents: string;
  relatedInstrumentsLabel: string;
  freshLiveBadge: string;
  freshRecentBadge: string;
  freshArchiveBadge: string;
  allCategoriesFilter: string;

  modeTechnicalBias: string;
  modeFundamentalMacro: string;
  fundamentalTitle: string;
  fundamentalSubtitle: string;
  stageBeforeLabel: string;
  stageAfterLabel: string;
  nextReleaseLabel: string;
  latestReleaseLabel: string;
  actualLabel: string;
  forecastLabel: string;
  previousLabel: string;
  revisionLabel: string;
  dataUnavailableLabel: string;
  policyImplicationLabel: string;
  reportBreakdownLabel: string;
  statementDiffLabel: string;
  assetImpactMatrixLabel: string;
  transmissionMechanismLabel: string;
  invalidationLabel: string;
  techConnectionLabel: string;
  postReactionLabel: string;
  sourceAttributionLabel: string;
  officialFactsTier: string;
  marketExpectationsTier: string;
  publishedSourcesTier: string;
  interpretationTier: string;
  bullishScenarioLabel: string;
  bearishScenarioLabel: string;
  neutralScenarioLabel: string;
  uncertaintyFactorsLabel: string;
  mixedReportFlagLabel: string;
  allEventsTimelineLabel: string;
  ownerFundamentalHeading: string;
  ownerFundamentalSyncBtn: string;
  fundamentalAlignBannerTitle: string;
  fundamentalViewBtn: string;
  technicalViewBtn: string;

  // Separate Social Channels & Multi-Market News Filters
  instagramChannelTitle: string;
  instagramChannelDesc: string;
  openInstagramBtn: string;
  telegramChannelTitle: string;
  telegramChannelDesc: string;
  openTelegramBtn: string;
  telegramHandleAria: string;
  marketFilterAll: string;
  marketFilterGold: string;
  marketFilterIndices: string;
  marketFilterForex: string;
  marketFilterCrypto: string;
  marketFilterOil: string;
  marketFilterMacro: string;
  assetFilterAll: string;
  impactHigh: string;
  impactMedium: string;
  impactLow: string;
  noMarketNewsTitle: string;
  noMarketNewsDesc: string;
  resetMarketFiltersBtn: string;
  openMacroBreakdownBtn: string;
  macroReleaseConnectedLabel: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    brand: 'YOUNEEL TRADING',
    tagline: 'Precision Institutional Market Intelligence & Journaling',
    navHome: 'Home',
    navMarkets: 'Terminal',
    navAnalysis: 'Daily Analysis',
    navJournal: 'Journal',
    navNews: 'News',
    navGiveaways: 'YOUNEEL GIVEAWAYS',
    navCompetitions: 'Broker Competitions',
    navBrokers: 'Brokers',
    navContact: 'Contact',
    navMore: 'More',
    navMenuLabel: 'Navigation menu',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signedInLabel: 'Signed in',
    adminBadge: 'Admin',
    deleteAccount: 'Delete My Account & Data',
    deleteConfirm: 'Are you sure you want to permanently delete your account, starting capital, and all trade history? This action cannot be undone.',
    deleteSuccess: 'Account and all trading data deleted successfully.',
    deletingBtn: 'Deleting...',
    cancelBtn: 'Cancel',
    closeBtn: 'Close',
    themeToggle: 'Toggle Theme',
    langToggle: 'Language',
    loadingPage: 'Loading workspace...',

    createAccountTitle: 'Create Account',
    forgotPasswordTitle: 'Reset Password',
    forgotPasswordDesc: 'Enter your registered email address and we will send you a password reset link.',
    forgotPasswordLink: 'Forgot password?',
    sendResetLink: 'Send Reset Link',
    sendingLabel: 'Sending...',
    resetEmailSent: 'Password reset link sent! Please check your email inbox and spam folder.',
    backToSignIn: 'Back to Sign In',
    emailAddressLabel: 'Email Address',
    passwordLabel: 'Password',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: 'Password (minimum 6 characters)',
    createAccountBtn: 'Create Account',
    signUpSuccessMsg: 'Account created successfully! Please check your email if verification is required.',
    alreadyHaveAccount: 'Already have an account? Sign In',
    dontHaveAccount: "Don't have an account? Create one",
    authErrorGeneric: 'Authentication failed. Please verify your credentials.',

    heroTag: 'Institutional Market Analysis & Journal',
    heroTitle: 'Master the Markets with Precision.',
    heroSubtitle: 'Institutional-grade technical analysis, real-time live market candles, automated position sizing, and AI-grounded macroeconomic news intelligence.',
    exploreMarkets: 'Analyze Markets',
    openJournal: 'Open Trading Journal',
    statsTitle: 'Engineered for Serious Traders',
    liveFeedsFeature: 'Pure Live Market Feeds',
    liveFeedsDesc: 'Authentic live candles and order book prices for XAUUSD, NASDAQ, BTCUSD, and EURUSD across M15, H1, H4, and D1 timeframes.',
    mt5JournalFeature: 'MT5-Style Trade Journal',
    mt5JournalDesc: 'Live floating P&L calculations, automated risk-based lot sizing, offline SL/TP trigger detection, and detailed equity performance metrics.',
    aiNewsFeature: 'AI Macroeconomic Intelligence',
    aiNewsDesc: 'Every economic headline analyzed in real-time with grounded sentiment (Bullish / Bearish / Neutral) and deep causal rationale.',
    brokerPartnershipFeature: 'Institutional Broker Execution',
    brokerPartnershipDesc: 'Direct verified registration access with premier global multi-asset liquidity providers HFM and TMGM.',
    educationalNoticeLabel: 'Educational Notice:',

    statusLive: 'LIVE',
    statusDelayed: 'DELAYED',
    statusStale: 'STALE',
    statusMarketClosed: 'MARKET CLOSED',
    statusDisconnected: 'DISCONNECTED',
    statusUnavailable: 'UNAVAILABLE',
    statusSync: 'SYNC',
    notAvailableShort: 'N/A',

    marketsTitle: 'Live Multi-Asset Analysis',
    marketsSubtitle: 'Mathematical indicator convergence across RSI, MACD, EMAs (20/50/200), ATR, and structural swing liquidity.',
    timeframe: 'Timeframe',
    lastUpdated: 'Last Updated',
    livePrice: 'Live Price',
    change24h: '24h Change',
    high24h: '24h High',
    low24h: '24h Low',
    bias: 'Overall Market Bias',
    bullish: 'Bullish',
    bearish: 'Bearish',
    neutral: 'Neutral',
    confidence: 'Indicator Agreement Confidence',
    keyLevels: 'Institutional Key Levels',
    support: 'Support Zone',
    resistance: 'Resistance Zone',
    pivot: 'Equilibrium Pivot',
    technicalSummary: 'Institutional Analysis Rationale',
    trendStructure: 'Market Structure',
    indicatorsOverview: 'Technical Indicator Matrix',
    educationalDisclaimer: 'DISCLAIMER: Educational technical analysis only. Not financial, investment, or trading advice. Past market behavior does not guarantee future results.',
    errorLoadingData: 'Live market data temporarily unavailable or rate limited. Please refresh shortly.',
    retry: 'Retry Feed',
    instrumentSelectorAria: 'Instrument Selector',
    bidLabel: 'Bid',
    askLabel: 'Ask',
    spreadLabel: 'Spread',
    chartToolsBtn: 'Chart Tools',
    chartEngineLabel: 'Chart Engine',
    chartEngineTradingView: 'TradingView',
    chartEngineQuant: 'Quant / SMC',
    candleStyleLabel: 'Candle Style',
    candleStyleCandles: 'Candlesticks',
    candleStyleHollow: 'Hollow Candles',
    candleStyleHeikin: 'Heikin Ashi',
    candleStyleLine: 'Line',
    drawingToolbarLabel: 'Drawing Toolbar',
    emaOverlayLabel: 'EMA 20 / 50 / 200',
    smcOverlayLabel: 'S/R, Pivot, OB & Liquidity',
    expandChartTitle: 'Expand Chart Full Width',
    showSidebarTitle: 'Show Watchlist & Analysis',
    watchlistLabel: 'Watchlist',
    marketsCountLabel: '8 Markets',
    dailyBiasQuantTitle: 'Daily Bias & Quant',
    alignLabel: 'Align',
    sessionLabel: 'Session',
    refLabel: 'Ref',
    calculatingDailyBias: 'Calculating NY daily bias snapshot...',
    openFullDailyAnalysis: 'Open Full Daily Analysis',
    instrumentDataFeedTitle: 'Instrument & Data Feed',
    assetLabel: 'Asset',
    contractLevLabel: 'Contract / Lev',
    quoteSourceLabel: 'Quote Source',
    candleFeedLabel: 'Candle Feed',
    lastUpdateLabel: 'Last Update',
    degradedFeedNotice: 'Degraded / delayed market feed active.',
    lastVerifiedPrefix: 'Last Verified:',
    tvFeedProvenanceNote: 'TradingView widget streams its own public venue quote and may show minor spread variance vs. the verified spot feed.',
    tvChartProvenanceBadge: 'TradingView Official Chart (External Public Venue Feed)',
    backendChartProvenanceBadge: 'Verified Backend OHLCV & Structural / SMC Levels (Quote-Synced)',
    noCandlesAvailable: 'No verified candle bars available from upstream feed for this timeframe.',
    tabPositions: 'Positions',
    tabPending: 'Pending',
    tabHistory: 'History',
    tabSmcZones: 'SMC Zones & Levels',
    floatingLabel: 'Floating',
    newOrderBtn: 'New Order',
    signInPaperTerminal: 'Sign In for Paper Terminal',
    collapseBlotter: 'Collapse Blotter',
    expandBlotter: 'Expand Blotter',
    signInPositionsPrompt: 'Sign in to track live paper positions, floating P&L, margin, and server-validated SL/TP triggers.',
    signInHistoryPrompt: 'Sign in to inspect your historical closed trades.',
    noPendingTitle: 'No Pending Limit / Stop Orders',
    noPendingDesc: 'Orders submitted via the terminal execute immediately at the server-verified market quote.',
    insufficientSmcBars: 'Insufficient bars for full structural decomposition.',
    quickOrderTitle: 'Market Order',
    executesAtServerQuote: 'Executes on server at verified quote',
    liveExecPriceLabel: 'Live Execution Price',
    riskPctShort: 'Risk %',
    lotsUnit: 'Lots',
    marginShort: 'Margin',
    orderNotePlaceholder: 'Order note (optional)',
    executingLabel: 'Executing...',
    orderBlocksLabel: 'Order Blocks',
    fvgsLabel: 'FVGs',
    liquidityPoolsLabel: 'Liquidity Pools',
    latestBosChochLabel: 'Latest BOS/CHoCH',
    activeCountSuffix: 'active',
    mappedCountSuffix: 'mapped',
    noneLabel: 'None',
    support1Label: 'Support 1',
    resistance1Label: 'Resistance 1',

    analysisTitle: 'Daily Market Analysis & Bias',
    analysisSubtitle: 'Immutable New York session daily directional bias snapshots built from real multi-timeframe OHLCV calculations and SMC structure.',
    archivedDateAria: 'Archived Daily Date',
    todayNyTag: '(Today NY)',
    archivedTag: '(Archived)',
    checkIntradayBtn: 'Check Intraday Validity',
    schedulerBtn: 'Scheduler',
    chartTerminalBtn: 'Chart Terminal',
    schedulerAuditTitle: 'Server Scheduler Audit — NY Market Date',
    archivedTodaySuffix: 'Archived Today',
    pendingStatus: 'Pending',
    checksSuffix: 'checks',
    colTime: 'Time',
    colJob: 'Job',
    colSymbol: 'Symbol',
    colDate: 'Date',
    colStatus: 'Status',
    computingAnalysisMsg: 'Computing multi-timeframe structure & daily bias...',
    nyDatePrefix: 'NY Date:',
    snapshotTimePrefix: 'Snapshot:',
    dataQualityPrefix: 'Data:',
    snapshotPricePrefix: 'Snapshot Price:',
    livePrefix: 'Live:',
    bullishScoreLabel: 'Bullish Score',
    bearishScoreLabel: 'Bearish Score',
    alignmentScoreLabel: 'Alignment',
    alignmentTooltip: 'Weighted structural alignment across available timeframes — not a probability forecast',
    conflictsBannerTitle: 'Detected Timeframe Structural Conflicts',
    colScoringComponent: 'Scoring Component',
    colWeight: 'Weight',
    colRawScore: 'Raw Score',
    colContribution: 'Contribution',
    colEvidence: 'Evidence',
    historicalEvalTitle: 'Archived Snapshot Outcome Evaluation',
    intradayTimelineTitle: 'Intraday Structure & Validity Log',
    immutableSnapshotNote: 'Snapshot remains immutable; updates logged separately',
    mtfMatrixTitle: 'Multi-Timeframe Structure & Indicator Matrix',
    colTf: 'TF',
    colBars: 'Bars',
    colRegime: 'Regime',
    colLean: 'Lean',
    colScore: 'Score',
    colLatestEvent: 'Latest Event',
    colEmaStack: 'EMA Stack',
    colDealingZone: 'Dealing Zone',
    liquidityAndSrTitle: 'Key Support, Resistance & Liquidity Pools',
    bslResistanceTitle: 'Buy-Side Liquidity (BSL / EQH) & Resistance',
    sslSupportTitle: 'Sell-Side Liquidity (SSL / EQL) & Support',
    detectedSweepsTitle: 'Detected Liquidity Sweeps',
    obFvgRangeTitle: 'Order Blocks, Fair Value Gaps & Dealing Range',
    activeOrderBlocksLabel: 'Active Order Blocks',
    noOrderBlocksMsg: 'No unmitigated order blocks within active lookback.',
    unfilledFvgLabel: 'Unfilled / Partial Fair Value Gaps',
    noFvgMsg: 'No active FVG imbalances remaining in range.',
    bullishScenarioTitle: 'Bullish Scenario',
    bearishScenarioTitle: 'Bearish Scenario',
    targetsLabel: 'Targets:',
    invalidationVolTitle: 'Invalidation & Volatility',
    volatilityLabel: 'Volatility:',
    dailyAtrLabel: 'Daily ATR:',
    volumeLabel: 'Volume:',
    quantInterpreterTitle: 'Quantitative Analyst Interpretation',
    explainedByModelPrefix: 'Strict deterministic explanation',
    deterministicOnlyLabel: 'Deterministic report only',
    marketStructureOverview: 'Market Structure Overview',
    deterministicEvidenceLabel: 'Deterministic Evidence',
    bullishPathLabel: 'Bullish Path',
    bearishPathLabel: 'Bearish Path',
    conflictsInvalidationLabel: 'Conflicts & Invalidation',
    conclusionLabel: 'Conclusion',
    matchedNewsContextTitle: 'Matched Macro News Context',
    alignmentNoteFooter: 'Directional Alignment Score reflects multi-timeframe mathematical rule agreement and does not represent a guaranteed outcome probability.',
    insufficientDataBadge: 'INSUFFICIENT DATA',
    validBadge: 'VALID',
    weakeningBadge: 'WEAKENING',
    invalidatedBadge: 'INVALIDATED',

    journalTitle: 'Institutional Trading Journal',
    journalSubtitle: 'Private, cloud-synchronized paper trading journal with real-time MT5 floating P&L and automated execution.',
    serverValidatedBadge: 'Server-Validated',
    loginRequired: 'Authentication Required',
    loginRequiredDesc: 'Please sign in or create a private account to access your personal trading journal, balance, and records.',
    startingCapital: 'Account Balance / Capital',
    setCapital: 'Edit Starting Capital',
    saveCapital: 'Save Capital',
    savingLabel: 'Saving...',
    capitalRangeHelp: 'Enter your initial starting capital ($10 – $100,000,000).',
    capitalRangeError: 'Starting capital must be between $10 and $100,000,000.',
    balance: 'Balance',
    equity: 'Equity',
    floatingPnl: 'Floating P&L',
    freeMargin: 'Free Margin',
    initialCapitalPrefix: 'Initial:',
    balancePlusFloating: 'Balance + Net Floating P&L',
    includesCommSwap: 'Includes commission & swap',
    marginUsedPrefix: 'Margin Used:',
    activePositionsPrefix: 'Active:',
    newTrade: 'Place New Trade',
    symbol: 'Asset Symbol',
    side: 'Order Side',
    buy: 'Buy (Long)',
    sell: 'Sell (Short)',
    buyShort: 'Buy',
    sellShort: 'Sell',
    entryPrice: 'Entry Price',
    stopLoss: 'Stop Loss (SL)',
    takeProfit: 'Take Profit (TP)',
    riskPct: 'Account Risk %',
    lotSize: 'Calculated Lot Size',
    contractSize: 'Contract Size per Lot',
    openTradeBtn: 'Execute Order',
    invalidSlTpBuy: 'For a BUY order: Stop Loss must be strictly below Entry, and Take Profit must be strictly above Entry.',
    invalidSlTpSell: 'For a SELL order: Stop Loss must be strictly above Entry, and Take Profit must be strictly below Entry.',
    openTrades: 'Open Positions (Live Floating P&L)',
    noOpenTrades: 'No open positions currently active.',
    manualClose: 'Close Position',
    tradeHistory: 'Trade History & Performance',
    noClosedTrades: 'No closed trades recorded yet.',
    winRate: 'Win Rate',
    totalProfit: 'Total Profit',
    totalLoss: 'Total Loss',
    netPnl: 'Net P&L',
    profitFactor: 'Profit Factor',
    avgRR: 'Avg Risk-to-Reward',
    bestTrade: 'Best Trade',
    worstTrade: 'Worst Trade',
    equityCurve: 'Cumulative Equity Curve',
    pointsCountSuffix: 'Point(s)',
    closeOneTradePrompt: 'Close at least one trade to plot account equity progression.',
    filterSymbol: 'Filter by Symbol',
    filterAll: 'All Assets',
    resetBtn: 'Reset',
    closeReason: 'Close Trigger',
    openedAt: 'Opened Time',
    closedAt: 'Closed Time',
    autoClosedHitSL: 'Position hit Stop Loss and was automatically closed.',
    autoClosedHitTP: 'Position reached Take Profit and was automatically closed.',
    colLots: 'Lots',
    colEntry: 'Entry',
    colLiveQuote: 'Live Quote',
    colExit: 'Exit',
    colCommSwap: 'Comm/Swap',
    colNetPnlUsd: 'Net P&L ($)',
    colAction: 'Action',
    colTrigger: 'Trigger',
    feedWaitLabel: 'Feed Wait',
    serverExecNotice: 'Orders execute on the server at the live verified market price.',
    execQuoteLabel: 'Execution Quote',
    feedOfflineLabel: 'Feed offline',
    marginEstPrefix: 'Margin Est:',
    maxRiskPrefix: 'Max Risk:',
    strategyNotesLabel: 'Strategy Notes (Optional)',
    strategyNotesPlaceholder: 'e.g. H4 structure retest',

    newsTitle: 'Macroeconomic News & Impact Intelligence',
    newsSubtitle: 'Real-time financial calendar headlines with asset impact ratings.',
    tabToday: "Today's Live News",
    tabOldNews: 'Historical Macro Archive',
    filterMarkets: 'Select Target Assets for Impact Analysis',
    expectedImpact: 'Expected Market Bias',
    aiAnalysisExplanation: 'Institutional Causal Breakdown',
    readSource: 'Read Original Wire',
    headlineArchive: 'Key Historical Macro Events Archive',
    whatHappened: 'What Happened',
    howItAffected: 'How It Affected Your Selected Markets',
    clickToExpand: 'Click event headline to review multi-asset transmission mechanism',
    verifiedProvidersPrefix: 'Verified Providers:',
    verifiedFinancialWire: 'Verified Financial News Wire',
    officialArchivesPrefix: 'Official Archives:',
    loadingVerifiedWire: 'Loading verified financial news wires...',
    loadingArchivesMsg: 'Loading official monetary policy & statistical archives...',
    noNewsMsg: 'No verified news items available from active providers right now.',
    noArchiveMsg: 'No official archive records currently available.',
    macroAssetImpactTitle: 'Macro Asset Impact Analysis',
    analyzeWithGeminiBtn: 'Analyze Macro Impact',
    reanalyzeSelectedBtn: 'Re-analyze Selected Assets',
    analyzingBtn: 'Analyzing...',

    giveawaysTitle: 'YOUNEEL GIVEAWAYS',
    giveawaysSubtitle: 'Participate in transparent community giveaways published and verified by YOUNEEL TRADING.',
    prizePool: 'Prize',
    rules: 'Official Rules & Eligibility',
    enterNow: 'Participate Now',
    signInToParticipate: 'Sign In to Participate',
    statusActive: 'Active Giveaway',
    statusEnded: 'Ended',
    publicViewBtn: 'Public View',
    adminConsoleBtn: 'Admin Console',
    newGiveawayBtn: 'Add Giveaway',
    giveawaysUnavailableTitle: 'YOUNEEL GIVEAWAYS Temporarily Unavailable',
    giveawaysUnavailableDesc: 'Community giveaways are currently being prepared. Please check back soon for upcoming events.',
    giveawaysUnavailableAdminDesc: 'The giveaway campaign tables are not initialized on this backend project yet. Apply the giveaway setup migration in your project dashboard.',
    noGiveawaysCreated: 'No giveaways created yet. Click "Add Giveaway" to publish a campaign.',
    noPublishedGiveawaysTitle: 'No published giveaways at the moment',
    noPublishedGiveawaysDesc: 'Upcoming community giveaways will appear here once published.',
    loadingGiveaways: 'Loading giveaways...',
    statusDraft: 'Draft',
    publishedTag: 'Published',
    unpublishedTag: 'Unpublished Draft',
    endsPrefix: 'Ends:',
    entriesPrefix: 'Entries:',
    winnerAnnouncedPrefix: 'Winner Announced:',
    winnerPrefix: 'Winner:',
    participantsBtn: 'Participants',
    publishBtn: 'Publish',
    unpublishBtn: 'Unpublish',
    startBtn: 'Start',
    endBtn: 'End',
    editLabel: 'Edit',
    deleteLabel: 'Delete',
    confirmBtn: 'Confirm',
    enteredStatusPrefix: 'Entered • Status:',
    participationRecorded: 'Your giveaway participation has been recorded.',
    giveawayCreatedMsg: 'Giveaway created.',
    giveawayUpdatedMsg: 'Giveaway updated.',
    giveawayDeletedMsg: 'Giveaway deleted.',
    enterGiveawayHeading: 'Enter:',
    submittingAsPrefix: 'Submitting as',
    verificationNoteLabel: 'Verification Note / Handle (Optional)',
    verificationNotePlaceholder: 'Optional Instagram handle or verification note',
    submittingBtn: 'Submitting...',
    confirmEntryBtn: 'Confirm Entry',
    editGiveawayTitle: 'Edit Giveaway',
    createGiveawayTitle: 'Create Giveaway',
    fieldTitleRequired: 'Title *',
    fieldPrizeRequired: 'Prize *',
    fieldDescription: 'Description',
    fieldRules: 'Rules & Eligibility',
    fieldImageUrl: 'Image URL (Optional)',
    fieldStartsAt: 'Starts At',
    fieldEndsAtRequired: 'Ends At *',
    fieldStatus: 'Status',
    optionDraft: 'Draft',
    optionActive: 'Active',
    optionEnded: 'Ended',
    publishToPublicLabel: 'Publish to Public',
    saveGiveawayBtn: 'Save Giveaway',
    participantsModalHeading: 'Participants',
    noEntriesSubmittedYet: 'No entries submitted yet.',
    approveTitle: 'Approve',
    rejectTitle: 'Reject',
    selectWinnerBtn: 'Select Winner',

    brokersTitle: 'Verified Brokerage Links',
    brokersSubtitle: 'Direct official portal links for supported global multi-asset brokers. Confirm regulatory entities, fees, and local availability directly on each broker portal.',
    verifiedBrokerBadge: 'Official Broker Portals',
    openLiveAccount: 'Visit Official Registration',
    hfmTagline: 'Multi-Asset CFD & FX Broker',
    hfmBadge: 'Partner',
    hfmDescription: 'Global multi-asset brokerage portal.',
    hfmFeatures: [
      'MetaTrader 4 & MetaTrader 5',
    ],
    tmgmTagline: 'Global ECN & Multi-Asset Broker',
    tmgmBadge: 'Partner',
    tmgmDescription: 'Global multi-asset brokerage portal.',
    tmgmFeatures: [
      'MetaTrader 4 & MetaTrader 5',
    ],
    affiliateDisclosure: 'AFFILIATE DISCLOSURE: YOUNEEL TRADING provides official partner registration links for HFM and TMGM. Opening an account through these links supports platform research at no extra fee.',
    riskWarning: 'RISK WARNING: CFDs and leveraged financial instruments carry a high level of risk to your capital and may not be suitable for all investors. Never trade with money you cannot afford to lose.',

    contactTitle: 'Official Social Channels',
    contactSubtitle: 'Connect with YOUNEEL TRADING on our official Instagram and Telegram channels.',
    connectInstagramHeading: 'Follow @youneel.i & @youne_el_i',
    instagramNotice: 'Stay connected via our verified Instagram (@youneel.i) and Telegram (@youne_el_i) channels for daily market breakdowns and community announcements.',
    instagramBtn: 'Instagram @youneel.i',
    telegramBtn: 'Telegram @youne_el_i',
    followHandleAria: 'Visit official YOUNEEL TRADING Instagram profile @youneel.i',
    dailyBreakdownsBadge: 'Daily Market Breakdowns',
    giveawayAlertsBadge: 'Giveaway Announcements',
    directInquiriesTitle: 'Direct Trader Inquiries & Broker Support',
    directInquiriesDesc: 'For inquiries regarding risk management education, community giveaways, or broker onboarding with HFM & TMGM, please reach out directly via Instagram direct message.',

    institutionalBadge: 'Institutional',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    allRightsReserved: 'YOUNEEL TRADING. All rights reserved.',
    paperTradingNote: 'All trading journal activity on YOUNEEL TRADING is simulated/paper trading protected by private account isolation. Content is strictly educational and does not constitute financial advice.',
    privacyClause1Title: '1. Private Account Isolation:',
    privacyClause1Body: 'Your starting capital profile, trade records, and account preferences are stored in an isolated cloud environment with strict row-level access controls so only you can view or manage your personal data.',
    privacyClause2Title: '2. Information Collection:',
    privacyClause2Body: 'When you register using Email and Password authentication, we store only your authentication identifier and email address. We never collect payment cards, banking details, or live brokerage passwords.',
    privacyClause3Title: '3. Data Erasure:',
    privacyClause3Body: 'You maintain full control over your history and can permanently erase your profile and trade records at any time via "Delete My Account & Data".',
    privacyClause4Title: '4. Market Feed & Security:',
    privacyClause4Body: 'Real-time market quotes are retrieved securely via server-side market data relays. Personal account details are never shared with upstream financial feed providers.',
    termsClause1Title: '1. Simulated / Paper Trading Only:',
    termsClause1Body: 'The trading journal and quick order features on YOUNEEL TRADING are strictly paper trading simulation tools built for educational practice and risk discipline. No live money execution occurs here.',
    termsClause2Title: '2. No Financial Advice:',
    termsClause2Body: 'All technical indicators, key price levels, daily bias reports, and macroeconomic news interpretations are strictly educational and do not constitute investment, financial, legal, or tax advice.',
    termsClause3Title: '3. Risk Disclosure:',
    termsClause3Body: 'Trading leveraged Forex, commodities (Gold), cryptocurrencies, and indices involves substantial risk of loss and is not suitable for every investor.',
    termsClause4Title: '4. Broker Partnerships:',
    termsClause4Body: 'Account registration with recommended brokers (HFM, TMGM) occurs independently on their regulated portals under their respective terms and oversight.',

    proprietaryBadge: 'YOUNEEL TRADING Proprietary',
    copyNoticeToast: 'Proprietary YOUNEEL TRADING analysis — copying is disabled on protected reports.',

    ownerStudioLabel: 'Owner Studio',
    featuredCompetitionsTitle: 'Featured Broker Competitions',
    featuredCompetitionsDesc: 'Verified official trading contests from partner brokers, kept separate from YOUNEEL GIVEAWAYS.',
    viewAllCompetitionsBtn: 'View All Competitions',
    competitionsTitle: 'BROKER COMPETITIONS',
    competitionsSubtitle: 'Official verified trading competitions and trader awards from TMGM, HFM, and partner brokers. Strictly separate from YOUNEEL GIVEAWAYS.',
    allBrokersFilter: 'All Brokers',
    allStatusesFilter: 'All Statuses',
    searchCompetitionsPlaceholder: 'Search competitions, prizes, or divisions...',
    noCompetitionsTitle: 'No Verified Broker Competitions Listed',
    noCompetitionsDesc: 'Official sources are monitored automatically. Verified competitions will appear here once approved and confirmed.',
    officialBrokerContest: 'Official Broker Competition',
    accountsLabel: 'accounts',
    verifiedPrefix: 'Verified',
    compPotentiallyOutdatedNotice: 'Official source temporarily unreachable during last verification check. Showing last verified details.',
    compRegDeadlineLabel: 'Registration Deadline',
    compDatesLabel: 'Competition Dates',
    compEligibilityLabel: 'Eligibility',
    compRequirementsLabel: 'Trading Requirements',
    participateOfficialBtn: 'Participate on Official Portal',
    officialSourceLinkLabel: 'Official Source',
    officialRulesLabel: 'Competition Rules',
    compStatusLive: 'LIVE',
    compStatusRegOpen: 'REGISTRATION OPEN',
    compStatusUpcoming: 'UPCOMING',
    compStatusEndingSoon: 'ENDING SOON',
    compStatusCompleted: 'COMPLETED',
    compStatusExpired: 'EXPIRED',
    compStatusUnverified: 'UNVERIFIED',
    brokerSourcesNote: 'Official discovery monitors TMGM (competition.tmgm.com/en) and HFM (hfm.com/int/en/promotions) without inventing unverified contests or cashback promos.',

    statusPaused: 'Paused',
    statusScheduled: 'Scheduled',
    statusArchived: 'Archived',
    previewPlaceholderTitle: 'Your Giveaway Title',
    previewPlaceholderPrize: '$1,000 Trading Credit / Prize',
    mediaUploadHeading: 'Giveaway Visual & Crop Editor',
    dragToReposition: 'Drag image to reposition focal point',
    selectImageFromComputer: 'Upload JPG, PNG, WEBP or AVIF (max 5 MB)',
    chooseImageFileBtn: 'Upload Image',
    cropAndUploadBtn: 'Crop & Upload to Storage',
    uploadingImageLabel: 'Uploading...',
    imageUploadedSuccess: 'Cropped image uploaded securely to Supabase Storage.',
    uploadMimeError: 'Only JPG, PNG, WEBP, or AVIF images are supported.',
    uploadSizeError: 'Image file size must be 5 MB or less.',
    uploadFailedFallback: 'Image upload failed. You can paste a verified HTTPS image URL below.',

    ownerStudioTitle: 'YOUNEEL Owner Studio',
    ownerStudioSubtitle: 'Private verified control center for YOUNEEL GIVEAWAYS, Broker Competitions, and security auditing.',
    ownerGateTitle: 'Private Owner Verification',
    ownerGateDesc: 'Sign in with your authorized Owner credentials, then complete single-use 5-minute email verification.',
    ownerOtpHeading: 'Email Verification Required',
    ownerOtpDesc: 'Enter the 6-digit single-use verification code sent to your registered owner inbox. Code expires in 5 minutes.',
    ownerOtpPlaceholder: '6-digit verification code',
    requestOtpBtn: 'Send Verification Code',
    verifyOtpBtn: 'Verify & Unlock Owner Studio',
    verifyingOtpBtn: 'Verifying...',
    resendOtpBtn: 'Resend Code',
    otpSentNotice: 'Verification code dispatched to your owner email. Valid for 5 minutes.',
    otpDeliveryMissingTitle: 'Server Email Delivery Not Configured',
    otpDeliveryMissingDesc: 'Configure SMTP_HOST, SMTP_USER, and SMTP_PASS (or RESEND_API_KEY) on the server environment to deliver 5-minute single-use owner verification codes.',
    unauthorizedOwnerTitle: 'Restricted Owner Area',
    unauthorizedOwnerDesc: 'Access to Owner Mode is strictly restricted to the verified platform owner account.',
    returnHomeBtn: 'Return to Platform',
    lockOwnerSessionBtn: 'Lock Studio',
    ownerTabGiveaways: 'Giveaway Builder',
    ownerTabCompetitions: 'Broker Competitions',
    ownerTabSecurity: 'Security & Logs',
    builderTabContent: '1. Content & Links',
    builderTabMedia: '2. Image & Crop',
    builderTabDesign: '3. Style & Colors',
    builderTabSchedule: '4. Lifecycle',
    builderLivePreview: 'Live Giveaway Preview',
    saveDraftBtn: 'Save Draft',
    publishNowBtn: 'Publish Now',
    scheduleBtn: 'Schedule Publish',
    duplicateBtn: 'Duplicate',
    pauseBtn: 'Pause',
    archiveBtn: 'Archive',
    unarchiveBtn: 'Restore',
    fieldSubtitle: 'Promotional Subtitle',
    fieldCtaLabel: 'Custom Button Label',
    fieldExternalUrl: 'External Participation URL (Optional)',
    fieldPublishAt: 'Scheduled Publish Time',
    designTemplateLabel: 'Visual Design Template',
    colorBgLabel: 'Card Background',
    colorSurfaceLabel: 'Prize Surface',
    colorAccentLabel: 'Accent Color',
    colorTextLabel: 'Text Color',
    fontPresetLabel: 'Typography Style',
    cornerRadiusLabel: 'Corner Radius',
    fontSansLabel: 'Modern Sans',
    fontSerifLabel: 'Editorial Serif',
    fontCondensedLabel: 'Bold Trading Display',
    fontArabicLabel: 'IBM Arabic Sans',
    compQueueHeading: 'Owner Review Queue',
    compAllHeading: 'All Tracked Broker Competitions',
    compAddManualBtn: 'Add Verified Competition',
    compSyncNowBtn: 'Run Official Discovery Sync',
    compSyncingBtn: 'Scanning Official Sources...',
    compApprovePublishBtn: 'Approve & Publish',
    compRejectBtn: 'Reject',
    compFeatureHomeBtn: 'Feature on Home',
    compUnfeatureHomeBtn: 'Unfeature',
    compAddBrokerBtn: 'Add Broker Source',
    discoveryLogsHeading: 'Automated Discovery Scheduler Logs',
    notificationsHeading: 'Owner Alerts & Change Feed',
    markAllReadBtn: 'Mark All Read',
    auditLogsHeading: 'Owner Security & Action Audit Trail',
    schedulerStatusHeading: 'Background Discovery Scheduler',
    emailDeliveryHeading: '2FA Email Transport',
    compBrokerLabel: 'Broker',
    compPrizePoolLabel: 'Prize Pool',
    compPrizeDetailsLabel: 'Prize Breakdown',
    compOfficialSourceLabel: 'Official Source URL',
    compOfficialRegLabel: 'Official Registration / Entry URL',
    compRulesUrlLabel: 'Official Rules URL',
    compRegStartLabel: 'Registration Opens',
    compRegEndLabel: 'Registration Deadline',
    compStartLabel: 'Competition Starts',
    compEndLabel: 'Competition Ends',
    compEligibilityInputLabel: 'Eligibility Summary',
    compTradingReqInputLabel: 'Trading Requirements',
    compStatusInputLabel: 'Competition Status',
    saveCompetitionBtn: 'Save Competition',
    brokerSlugPlaceholder: 'Broker slug (e.g. pepperstone)',
    brokerNamePlaceholder: 'Broker display name',
    brokerSitePlaceholder: 'Official website URL',
    brokerSourcePlaceholder: 'Official competition page URL',
    ownerDiagHeading: 'Owner Authentication Diagnostics',
    ownerDiagSubtitle: 'Live server-side verification checks (secrets and credentials are never exposed).',
    diagSupabaseAuth: 'Supabase Authentication',
    diagUserId: 'Authenticated User ID',
    diagOwnerRole: 'Owner Role Verification',
    diagEmailVerify: 'Email OTP Verification',
    diagEmailDelivery: 'Email Delivery Transport',
    diagSessionValid: 'Owner Session Validity',
    diagAuthResult: 'Authorization Result',
    ownerProvisionToggle: 'First time? Provision exclusive owner credentials',
    ownerProvisionBackToSignIn: 'Already provisioned? Sign in',
    ownerProvisionBtn: 'Provision Owner Account',
    ownerProvisionDesc: 'Registers the configured owner email with Supabase Auth. Server authorization and 5-minute 2FA verification remain strictly enforced.',
    ownerResendCooldownPrefix: 'Resend available in',
    refreshBtn: 'Refresh',

    giveawaySponsorLabel: 'Sponsor',
    entriesSuffix: 'entries',
    giveawayEligibilityLabel: 'Eligibility Criteria',
    giveawayCountryRestrictionsLabel: 'Country Restrictions',
    giveawayCapacityFull: 'Capacity Full',
    giveawayMaxParticipantsLabel: 'Max Participants (Optional)',
    giveawayDiagnosticsTitle: 'Giveaway Backend Diagnostics',
    diagTablesLabel: 'Tables',
    diagPermissionsLabel: 'Permissions',
    diagStorageLabel: 'Storage Bucket',
    diagAuthLabel: 'Authentication',
    diagOtherDbLabel: 'Other DB Checks',
    diagSqlActionPrompt: 'Run the SQL migration below in your Supabase SQL Editor, then refresh diagnostics:',
    markCompletedBtn: 'Mark Completed',
    giveawaysGroupActive: 'Active Giveaways',
    giveawaysGroupUpcoming: 'Upcoming Giveaways',
    giveawaysGroupCompleted: 'Completed & Past Giveaways',
    giveawaysSchemaMissingTitle: 'YOUNEEL GIVEAWAYS Backend Setup Required',

    brokerSpecsHeading: 'Verified Account & Execution Specifications',
    brokerFactVerified: 'Verified Broker Specs',
    brokerFactConfirm: 'Confirm latest regional terms on official portal',

    contactSuccessMsg: 'Your inquiry has been submitted securely. Our team will review it shortly.',
    contactNameLabel: 'Full Name',
    contactNamePlaceholder: 'Enter your name',
    contactSubjectLabel: 'Subject',
    contactSubjectPlaceholder: 'Education, Broker Onboarding, or Giveaway Support',
    contactMessageLabel: 'Message',
    contactMessagePlaceholder: 'Write your message clearly...',
    contactSendBtn: 'Send Inquiry',

    homeDailyBiasHeading: 'Today NY Session Daily Bias',
    viewAllGiveawaysBtn: 'View All Giveaways',
    homeLatestNewsHeading: 'Latest Market Headlines',
    homeNewsUnavailableNotice: 'Live verified financial news wires are temporarily unavailable.',

    maxDrawdownLabel: 'Max Drawdown',
    journalSearchPlaceholder: 'Search notes, strategy, or symbol...',
    journalStrategyLabel: 'Strategy / Setup',
    allStrategiesFilter: 'All Strategies',
    journalEmotionsLabel: 'Execution Psychology',
    journalEntryReasonLabel: 'Entry Rationale',
    journalExitReasonLabel: 'Exit Rationale',
    journalMistakesLabel: 'Lessons & Mistakes',
    journalScreenshotLabel: 'Chart Screenshot URL or Upload',
    editJournalTitle: 'Edit Trade Journal Entry',
    saveJournalBtn: 'Save Journal Entry',

    ownerTabOverview: 'Overview',
    ownerTabUsers: 'Users & Inquiries',
    ownerOverviewHeading: 'Platform Overview Metrics',
    metricUsersLabel: 'Registered Users',
    metricTradesLabel: 'Recorded Trades',
    metricGiveawaysLabel: 'Giveaways',
    metricParticipantsLabel: 'Giveaway Entries',
    metricCompetitionsLabel: 'Broker Competitions',
    metricInquiriesLabel: 'Contact Inquiries',
    ownerUsersHeading: 'Registered Trader Accounts & Roles',
    setTraderRoleBtn: 'Set Trader',
    setAdminRoleBtn: 'Set Admin',
    ownerInquiriesHeading: 'Submitted Contact Inquiries',
    noInquiriesYet: 'No contact inquiries submitted yet.',

    brokerOfficialDomain: 'Official Website',
    brokerVerifyDirectNote: 'Always verify the applicable regulatory entity, fee schedule, and regional availability directly on the broker’s official portal before opening an account.',

    tabMacroEvents: 'US Macro Events (CPI • FOMC • PPI • NFP)',
    relatedInstrumentsLabel: 'Related Markets',
    freshLiveBadge: 'LIVE WIRE',
    freshRecentBadge: 'RECENT',
    freshArchiveBadge: 'ARCHIVE',
    allCategoriesFilter: 'All Categories',

    modeTechnicalBias: 'Technical Daily Bias',
    modeFundamentalMacro: 'Fundamental Macro (CPI / FOMC / PPI / NFP)',
    fundamentalTitle: 'Institutional Fundamental Analysis',
    fundamentalSubtitle: 'Official Federal Reserve, BLS, and FRED macroeconomic releases tracked across Before-Release & After-Release stages with 8-asset impact & technical alignment cross-checks.',
    stageBeforeLabel: 'Stage 1: Before Release (Preserved)',
    stageAfterLabel: 'Stage 2: After Release (Actuals & Revisions)',
    nextReleaseLabel: 'Next Scheduled Release',
    latestReleaseLabel: 'Latest Official Release',
    actualLabel: 'Actual',
    forecastLabel: 'Consensus Forecast',
    previousLabel: 'Previous',
    revisionLabel: 'Revision',
    dataUnavailableLabel: 'DATA UNAVAILABLE',
    policyImplicationLabel: 'Policy & Market Implication',
    reportBreakdownLabel: 'Official Report Breakdown',
    statementDiffLabel: 'FOMC Statement Changes & Policy Signals',
    assetImpactMatrixLabel: '8-Asset Fundamental Impact Matrix',
    transmissionMechanismLabel: 'Transmission Mechanism',
    invalidationLabel: 'Invalidation Conditions',
    techConnectionLabel: 'Fundamental vs Technical',
    postReactionLabel: 'Post-Release Market Reaction',
    sourceAttributionLabel: '4-Tier Verifiable Research Attribution',
    officialFactsTier: '1. Official Economic Facts',
    marketExpectationsTier: '2. Market Expectations / Consensus',
    publishedSourcesTier: '3. Published Official Sources',
    interpretationTier: '4. Analytical Interpretation',
    bullishScenarioLabel: 'Bullish Macro Scenario',
    bearishScenarioLabel: 'Bearish Macro Scenario',
    neutralScenarioLabel: 'Neutral / In-Line Scenario',
    uncertaintyFactorsLabel: 'Key Uncertainty Factors',
    mixedReportFlagLabel: 'Mixed Report Signal — Avoid Single-Number Simplification',
    allEventsTimelineLabel: 'Macro Release Timeline & Archive',
    ownerFundamentalHeading: 'Fundamental Macro Sources & Sync Diagnostics',
    ownerFundamentalSyncBtn: 'Sync Macro Sources Now',
    fundamentalAlignBannerTitle: 'Macro Fundamental vs Technical Cross-Check',
    fundamentalViewBtn: 'Inspect Full Macro Event',
    technicalViewBtn: 'Open Technical Bias',

    instagramChannelTitle: 'Instagram',
    instagramChannelDesc: 'Daily chart breakdowns, session commentary, and visual market setups published directly on our official Instagram profile.',
    openInstagramBtn: 'Open Instagram',
    telegramChannelTitle: 'Telegram',
    telegramChannelDesc: 'Real-time market notes, macro release alerts, and direct community announcements on our official Telegram channel.',
    openTelegramBtn: 'Open Telegram',
    telegramHandleAria: 'Contact us on Telegram @youne_el_i',
    marketFilterAll: 'ALL MARKETS',
    marketFilterGold: 'GOLD',
    marketFilterIndices: 'NASDAQ / US INDICES',
    marketFilterForex: 'FOREX',
    marketFilterCrypto: 'CRYPTO',
    marketFilterOil: 'OIL & COMMODITIES',
    marketFilterMacro: 'US ECONOMY / MACRO',
    assetFilterAll: 'All Assets',
    impactHigh: 'High Impact',
    impactMedium: 'Medium Impact',
    impactLow: 'Market Brief',
    noMarketNewsTitle: 'No Verified Articles for This Market Filter',
    noMarketNewsDesc: 'No fresh verified financial wire reports matched the selected market or asset filter in the active window. Switch back to ALL MARKETS or refresh to check again.',
    resetMarketFiltersBtn: 'Show ALL MARKETS',
    openMacroBreakdownBtn: 'Open CPI • FOMC • PPI • NFP Analysis',
    macroReleaseConnectedLabel: 'Connected US Macro Release',
  },
  ar: {
    brand: 'يونيل للتداول',
    tagline: 'منصة التحليل الفني المؤسسي وسجل التداول الاحترافي',
    navHome: 'الرئيسية',
    navMarkets: 'منصة التداول',
    navAnalysis: 'التحليل اليومي',
    navJournal: 'سجل التداول',
    navNews: 'الأخبار',
    navGiveaways: 'جوائز YOUNEEL',
    navCompetitions: 'مسابقات الوسطاء',
    navBrokers: 'شركات الوساطة',
    navContact: 'تواصل معنا',
    navMore: 'المزيد',
    navMenuLabel: 'قائمة التنقل',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    signedInLabel: 'تم تسجيل الدخول',
    adminBadge: 'مشرف',
    deleteAccount: 'حذف حسابي وبياناتي',
    deleteConfirm: 'هل أنت متأكد من رغبتك في حذف حسابك ورأس المال وسجل الصفقات نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteSuccess: 'تم حذف الحساب وكافة بيانات التداول بنجاح.',
    deletingBtn: 'جارٍ الحذف...',
    cancelBtn: 'إلغاء',
    closeBtn: 'إغلاق',
    themeToggle: 'تغيير المظهر',
    langToggle: 'اللغة',
    loadingPage: 'جارٍ تحميل القسم...',

    createAccountTitle: 'إنشاء حساب جديد',
    forgotPasswordTitle: 'استعادة كلمة المرور',
    forgotPasswordDesc: 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.',
    forgotPasswordLink: 'نسيت كلمة المرور؟',
    sendResetLink: 'إرسال رابط الاستعادة',
    sendingLabel: 'جارٍ الإرسال...',
    resetEmailSent: 'تم إرسال رابط إعادة تعيين كلمة المرور! يرجى تفقد بريدك الوارد ورسائل البريد غير المرغوب فيها.',
    backToSignIn: 'العودة إلى تسجيل الدخول',
    emailAddressLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: 'كلمة المرور (6 خانات على الأقل)',
    createAccountBtn: 'إنشاء حساب',
    signUpSuccessMsg: 'تم إنشاء الحساب بنجاح! يرجى تفقد بريدك الإلكتروني إذا تطلب الحساب تأكيداً.',
    alreadyHaveAccount: 'لديك حساب بالفعل؟ تسجيل الدخول',
    dontHaveAccount: 'ليس لديك حساب؟ إنشاء حساب جديد',
    authErrorGeneric: 'تعذر إتمام المصادقة. يرجى التحقق من البيانات المدخلة.',

    heroTag: 'منصة التداول والتحليل المؤسسي',
    heroTitle: 'احترف أسواق المال بدقة مؤسسية.',
    heroSubtitle: 'تحليل فني متقدم، شموع وأسعار حية ولحظية، حساب تلقائي لحجم العقود وإدارة المخاطر، وتحليل ذكي للأخبار الاقتصادية.',
    exploreMarkets: 'تحليل الأسواق الحية',
    openJournal: 'فتح سجل التداول',
    statsTitle: 'مصممة خصيصاً للمتداولين المحترفين',
    liveFeedsFeature: 'بيانات حقيقية ولحظية 100%',
    liveFeedsDesc: 'شموع وأسعار فورية حقيقية للذهب (XAUUSD)، وناسداك (NASDAQ)، والبيتكوين (BTCUSD)، واليورو/دولار (EURUSD) عبر مختلف الفترات الزمنية.',
    mt5JournalFeature: 'سجل صفقات بأسلوب MT5',
    mt5JournalDesc: 'تحديث فوري للأرباح والخسائر العائمة، وإغلاق تلقائي عند ضرب الهدف أو وقف الخسارة، ومتابعة متقدمة لمنحنى رأس المال.',
    aiNewsFeature: 'تحليل اقتصادي ذكي',
    aiNewsDesc: 'تقييم لحظي لتأثير كل خبر اقتصادي (صعودي / هبوطي / محايد) مع توضيح عميق للأسباب الاقتصادية المنطقية.',
    brokerPartnershipFeature: 'وساطة مالية مرخصة وموثوقة',
    brokerPartnershipDesc: 'روابط تسجيل رسمية مع كبرى شركات الوساطة العالمية المرخصة HFM و TMGM بفروقات سعرية متناهية الصغر.',
    educationalNoticeLabel: 'تنبيه تعليمي:',

    statusLive: 'مباشر',
    statusDelayed: 'متأخر',
    statusStale: 'مخزّن مؤقتاً',
    statusMarketClosed: 'السوق مغلق',
    statusDisconnected: 'غير متصل',
    statusUnavailable: 'غير متاح',
    statusSync: 'مزامنة',
    notAvailableShort: 'غير متاح',

    marketsTitle: 'التحليل الفني للأسواق المالية',
    marketsSubtitle: 'تكامل المؤشرات الفنية الرياضية (RSI، MACD، EMAs 20/50/200، ATR) ومناطق السيولة والدعوم والمقاومات.',
    timeframe: 'الإطار الزمني',
    lastUpdated: 'آخر تحديث',
    livePrice: 'السعر الحالي',
    change24h: 'التغير خلال 24 ساعة',
    high24h: 'أعلى سعر 24 ساعة',
    low24h: 'أدنى سعر 24 ساعة',
    bias: 'الاتجاه العام المتوقع',
    bullish: 'صعودي (Bullish)',
    bearish: 'هبوطي (Bearish)',
    neutral: 'محايد (Neutral)',
    confidence: 'نسبة توافق المؤشرات',
    keyLevels: 'المستويات السعرية الهامة',
    support: 'منطقة الدعم',
    resistance: 'منطقة المقاومة',
    pivot: 'نقطة الارتكاز (Pivot)',
    technicalSummary: 'التقرير التحليلي الفني',
    trendStructure: 'هيكل السوق والاتجاه',
    indicatorsOverview: 'مصفوفة المؤشرات الفنية',
    educationalDisclaimer: 'إخلاء مسؤولية: هذا التحليل الفني لأغراض تعليمية بحتة ولا يُعتبر توصية مالية أو استثمارية. الأداء السابق لا يضمن النتائج المستقبلية في الأسواق.',
    errorLoadingData: 'بيانات السوق الحية غير متاحة حالياً أو وصلت لحد الطلبات. يرجى إعادة المحاولة بعد قليل.',
    retry: 'إعادة تحميل البيانات',
    instrumentSelectorAria: 'اختيار الأداة المالية',
    bidLabel: 'شراء (Bid)',
    askLabel: 'بيع (Ask)',
    spreadLabel: 'السبريد',
    chartToolsBtn: 'أدوات الرسم',
    chartEngineLabel: 'محرك المخطط',
    chartEngineTradingView: 'TradingView',
    chartEngineQuant: 'التحليل الكمي / SMC',
    candleStyleLabel: 'نمط الشموع',
    candleStyleCandles: 'شموع يابانية',
    candleStyleHollow: 'شموع مفرغة',
    candleStyleHeikin: 'هايكين آشي',
    candleStyleLine: 'مخطط خطي',
    drawingToolbarLabel: 'شريط أدوات الرسم',
    emaOverlayLabel: 'المتوسطات EMA 20 / 50 / 200',
    smcOverlayLabel: 'الدعوم والمقاومات والسيولة و OB',
    expandChartTitle: 'توسيع المخطط بعرض كامل',
    showSidebarTitle: 'إظهار قائمة المراقبة والتحليل',
    watchlistLabel: 'قائمة المراقبة',
    marketsCountLabel: '8 أسواق',
    dailyBiasQuantTitle: 'التحيز اليومي والتحليل الكمي',
    alignLabel: 'التوافق',
    sessionLabel: 'الجلسة',
    refLabel: 'السعر المرجعي',
    calculatingDailyBias: 'جارٍ حساب التحيز اليومي لجلسة نيويورك...',
    openFullDailyAnalysis: 'فتح التقرير اليومي الكامل',
    instrumentDataFeedTitle: 'مواصفات الأداة ومصدر البيانات',
    assetLabel: 'الأداة',
    contractLevLabel: 'حجم العقد / الرافعة',
    quoteSourceLabel: 'مصدر السعر اللحظي',
    candleFeedLabel: 'مصدر الشموع',
    lastUpdateLabel: 'آخر تحديث',
    degradedFeedNotice: 'يتم عرض بيانات متأخرة أو بديلة مؤقتاً.',
    lastVerifiedPrefix: 'آخر توثيق:',
    tvFeedProvenanceNote: 'يعتمد مخطط TradingView على مزود الأسعار الخارجي الخاص به وقد يختلف بفارق بسيط عن السعر الفوري الموثق.',
    tvChartProvenanceBadge: 'مخطط TradingView الرسمي (مزود السوق العام الخارجي)',
    backendChartProvenanceBadge: 'شموع OHLCV ومستويات السيولة الموثقة من الخادم (متزامنة مع السعر اللحظي)',
    noCandlesAvailable: 'لا توجد شموع متاحة من مزود البيانات لهذا الإطار الزمني حالياً.',
    tabPositions: 'الصفقات المفتوحة',
    tabPending: 'الأوامر المعلقة',
    tabHistory: 'السجل',
    tabSmcZones: 'مناطق السيولة و SMC',
    floatingLabel: 'العائم',
    newOrderBtn: 'أمر جديد',
    signInPaperTerminal: 'سجّل الدخول لاستخدام منصة التداول',
    collapseBlotter: 'طي اللوحة السفلية',
    expandBlotter: 'توسيع اللوحة السفلية',
    signInPositionsPrompt: 'سجّل الدخول لمتابعة الصفقات المفتوحة، الأرباح العائمة، الهامش، وإغلاق SL/TP الموثق على الخادم.',
    signInHistoryPrompt: 'سجّل الدخول لاستعراض سجل الصفقات المغلقة.',
    noPendingTitle: 'لا توجد أوامر حد أو إيقاف معلقة',
    noPendingDesc: 'يتم تنفيذ الأوامر المرسلة من المنصة فورياً وفق سعر السوق الموثق على الخادم.',
    insufficientSmcBars: 'الشموع المتاحة غير كافية لإتمام التحليل الهيكلي الكامل.',
    quickOrderTitle: 'أمر سوق مباشر',
    executesAtServerQuote: 'يُنفّذ على الخادم وفق السعر الموثق',
    liveExecPriceLabel: 'سعر التنفيذ اللحظي',
    riskPctShort: 'نسبة المخاطرة %',
    lotsUnit: 'لوت',
    marginShort: 'الهامش',
    orderNotePlaceholder: 'ملاحظة للصفقة (اختياري)',
    executingLabel: 'جارٍ التنفيذ...',
    orderBlocksLabel: 'مناطق الطلب والعرض (OB)',
    fvgsLabel: 'فجوات القيمة العادلة (FVG)',
    liquidityPoolsLabel: 'مجمعات السيولة',
    latestBosChochLabel: 'آخر كسر هيكلي BOS/CHoCH',
    activeCountSuffix: 'نشط',
    mappedCountSuffix: 'محددة',
    noneLabel: 'لا يوجد',
    support1Label: 'الدعم 1',
    resistance1Label: 'المقاومة 1',

    analysisTitle: 'التحليل اليومي للأسواق',
    analysisSubtitle: 'لقطات تحيز يومية ثابتة بتوقيت جلسة نيويورك مبنية على بيانات OHLCV الحقيقية وهيكل السيولة متعدد الأطر.',
    archivedDateAria: 'تاريخ التحليل المؤرشف',
    todayNyTag: '(اليوم نيويورك)',
    archivedTag: '(أرشيف)',
    checkIntradayBtn: 'تحديث الحالة اللحظية',
    schedulerBtn: 'حالة المجدول',
    chartTerminalBtn: 'منصة التداول',
    schedulerAuditTitle: 'تدقيق المجدول الخلفي — تاريخ جلسة نيويورك',
    archivedTodaySuffix: 'مؤرشف اليوم',
    pendingStatus: 'قيد الانتظار',
    checksSuffix: 'فحوصات',
    colTime: 'الوقت',
    colJob: 'المهمة',
    colSymbol: 'الأداة',
    colDate: 'التاريخ',
    colStatus: 'الحالة',
    computingAnalysisMsg: 'جارٍ حساب هيكل الأطر المتعددة والتحيز اليومي...',
    nyDatePrefix: 'تاريخ نيويورك:',
    snapshotTimePrefix: 'وقت اللقطة:',
    dataQualityPrefix: 'جودة البيانات:',
    snapshotPricePrefix: 'سعر اللقطة:',
    livePrefix: 'الحي:',
    bullishScoreLabel: 'نقاط الصعود',
    bearishScoreLabel: 'نقاط الهبوط',
    alignmentScoreLabel: 'التوافق الاتجاهي',
    alignmentTooltip: 'مقياس التوافق الرياضي المرجّح عبر الأطر الزمنية المتاحة — وليس توقعاً مضموناً',
    conflictsBannerTitle: 'تعارضات هيكلية مكتشفة بين الأطر الزمنية',
    colScoringComponent: 'مكوّن التقييم',
    colWeight: 'الوزن',
    colRawScore: 'الدرجة الأولية',
    colContribution: 'المساهمة',
    colEvidence: 'الدليل الكمي',
    historicalEvalTitle: 'تقييم نتائج اللقطة التاريخية المؤرشفة',
    intradayTimelineTitle: 'سجل الهيكل والصلاحية اللحظية',
    immutableSnapshotNote: 'تبقى اللقطة اليومية ثابتة؛ تُسجل التحديثات اللحظية بشكل منفصل',
    mtfMatrixTitle: 'مصفوفة الهيكل والمؤشرات متعددة الأطر الزمنية',
    colTf: 'الإطار',
    colBars: 'الشموع',
    colRegime: 'النظام السعري',
    colLean: 'الميل',
    colScore: 'النتيجة',
    colLatestEvent: 'أحدث إشارة هيكلية',
    colEmaStack: 'ترتيب المتوسطات',
    colDealingZone: 'نطاق السعر',
    liquidityAndSrTitle: 'الدعوم والمقاومات ومجمعات السيولة الرئيسية',
    bslResistanceTitle: 'سيولة جانب الشراء (BSL / EQH) والمقاومة',
    sslSupportTitle: 'سيولة جانب البيع (SSL / EQL) والدعم',
    detectedSweepsTitle: 'عمليات سحب السيولة المرصودة',
    obFvgRangeTitle: 'مناطق الطلب والعرض والفجوات السعرية ونطاق التداول',
    activeOrderBlocksLabel: 'مناطق OB النشطة',
    noOrderBlocksMsg: 'لا توجد مناطق OB غير مختبرة ضمن النطاق الحالي.',
    unfilledFvgLabel: 'فجوات القيمة العادلة غير المغطاة',
    noFvgMsg: 'لا توجد فجوات سعرية نشطة متبقية في النطاق.',
    bullishScenarioTitle: 'السيناريو الصعودي',
    bearishScenarioTitle: 'السيناريو الهبوطي',
    targetsLabel: 'الأهداف:',
    invalidationVolTitle: 'شروط الإلغاء والتقلبات',
    volatilityLabel: 'التقلبات:',
    dailyAtrLabel: 'ATR اليومي:',
    volumeLabel: 'السيولة والحجم:',
    quantInterpreterTitle: 'القراءة التحليلية للمحلل الكمي',
    explainedByModelPrefix: 'تفسير منطقي مبني على البيانات الكمية',
    deterministicOnlyLabel: 'تقرير رياضي كمي مباشر',
    marketStructureOverview: 'نظرة عامة على هيكل السوق',
    deterministicEvidenceLabel: 'الأدلة الرياضية الموثقة',
    bullishPathLabel: 'المسار الصعودي',
    bearishPathLabel: 'المسار الهبوطي',
    conflictsInvalidationLabel: 'التعارضات وحدود الإلغاء',
    conclusionLabel: 'الخلاصة',
    matchedNewsContextTitle: 'الأخبار الاقتصادية المرتبطة بالأصل',
    alignmentNoteFooter: 'يعكس مؤشر التوافق الاتجاهي درجة انسجام القواعد الرياضية عبر الأطر الزمنية ولا يمثل نسبة نجاح مضمونة.',
    insufficientDataBadge: 'بيانات غير كافية',
    validBadge: 'صالح',
    weakeningBadge: 'ضعف تدريجي',
    invalidatedBadge: 'ملغى',

    journalTitle: 'سجل التداول المؤسسي',
    journalSubtitle: 'سجل تداول تجريبي خاص ومحمي سحابياً مع حساب فوري للأرباح العائمة مثل منصة MT5 وتنفيذ تلقائي.',
    serverValidatedBadge: 'موثق من الخادم',
    loginRequired: 'تسجيل الدخول مطلوب',
    loginRequiredDesc: 'يرجى تسجيل الدخول أو إنشاء حساب خاص للوصول إلى سجل صفقاتك ورأس مالك الشخصي.',
    startingCapital: 'رأس مال الحساب الأولي',
    setCapital: 'تعديل رأس المال',
    saveCapital: 'حفظ رأس المال',
    savingLabel: 'جارٍ الحفظ...',
    capitalRangeHelp: 'أدخل رأس المال المبدئي للحساب (من 10$ إلى 100,000,000$).',
    capitalRangeError: 'يجب أن يكون رأس المال المبدئي بين 10$ و 100,000,000$.',
    balance: 'الرصيد (Balance)',
    equity: 'السيولة الحالية (Equity)',
    floatingPnl: 'الربح/الخسارة العائمة',
    freeMargin: 'الهامش المتاح (Free Margin)',
    initialCapitalPrefix: 'المبدئي:',
    balancePlusFloating: 'الرصيد + صافي الربح/الخسارة العائمة',
    includesCommSwap: 'يشمل العمولات ورسوم التبييت',
    marginUsedPrefix: 'الهامش المحجوز:',
    activePositionsPrefix: 'نشط:',
    newTrade: 'فتح صفقة جديدة',
    symbol: 'رمز الأصل',
    side: 'نوع الصفقة',
    buy: 'شراء (Buy / Long)',
    sell: 'بيع (Sell / Short)',
    buyShort: 'شراء',
    sellShort: 'بيع',
    entryPrice: 'سعر الدخول',
    stopLoss: 'وقف الخسارة (SL)',
    takeProfit: 'أخذ الربح (TP)',
    riskPct: 'نسبة المخاطرة من الحساب %',
    lotSize: 'حجم اللوت المحسوب تلقائياً',
    contractSize: 'حجم العقد لكل لوت',
    openTradeBtn: 'تنفيذ أمر التداول',
    invalidSlTpBuy: 'لأمر الشراء: يجب أن يكون وقف الخسارة أسفل سعر الدخول، والهدف أعلى من سعر الدخول.',
    invalidSlTpSell: 'لأمر البيع: يجب أن يكون وقف الخسارة أعلى من سعر الدخول، والهدف أسفل سعر الدخول.',
    openTrades: 'الصفقات المفتوحة (الربح العائم لحظياً)',
    noOpenTrades: 'لا توجد صفقات مفتوحة حالياً.',
    manualClose: 'إغلاق الصفقة يدوياً',
    tradeHistory: 'سجل الصفقات المغلقة والإحصائيات',
    noClosedTrades: 'لا توجد صفقات مغلقة مسجلة بعد.',
    winRate: 'نسبة الصفقات الرابحة',
    totalProfit: 'إجمالي الأرباح',
    totalLoss: 'إجمالي الخسائر',
    netPnl: 'صافي الربح/الخسارة',
    profitFactor: 'عامل الربحية (Profit Factor)',
    avgRR: 'متوسط العائد للمخاطرة (R:R)',
    bestTrade: 'أفضل صفقة',
    worstTrade: 'أسوأ صفقة',
    equityCurve: 'منحنى نمو رأس المال',
    pointsCountSuffix: 'نقطة',
    closeOneTradePrompt: 'أغلق صفقة واحدة على الأقل لرسم منحنى نمو رأس المال.',
    filterSymbol: 'تصفية حسب الرمز',
    filterAll: 'كافة الأصول',
    resetBtn: 'إعادة ضبط',
    closeReason: 'سبب الإغلاق',
    openedAt: 'وقت الفتح',
    closedAt: 'وقت الإغلاق',
    autoClosedHitSL: 'وصل السعر إلى وقف الخسارة وتم إغلاق الصفقة تلقائياً.',
    autoClosedHitTP: 'وصل السعر إلى الهدف وتم إغلاق الصفقة بنجاح.',
    colLots: 'اللوت',
    colEntry: 'الدخول',
    colLiveQuote: 'السعر الحي',
    colExit: 'الخروج',
    colCommSwap: 'العمولة/التبييت',
    colNetPnlUsd: 'صافي الربح ($)',
    colAction: 'الإجراء',
    colTrigger: 'الإغلاق',
    feedWaitLabel: 'بانتظار السعر',
    serverExecNotice: 'يتم تنفيذ الصفقات على الخادم وفق آخر سعر سوق موثق.',
    execQuoteLabel: 'سعر التنفيذ',
    feedOfflineLabel: 'المزود غير متصل',
    marginEstPrefix: 'الهامش التقديري:',
    maxRiskPrefix: 'أقصى مخاطرة:',
    strategyNotesLabel: 'ملاحظات الاستراتيجية (اختياري)',
    strategyNotesPlaceholder: 'مثال: إعادة اختبار هيكل H4',

    newsTitle: 'الأخبار الاقتصادية وتأثيرها المالي',
    newsSubtitle: 'متابعة حية لأهم أحداث التقويم الاقتصادي مع تحليل التأثير المتوقع على الأصول.',
    tabToday: 'أخبار اليوم اللحظية',
    tabOldNews: 'أرشيف الأحداث التاريخية الكبرى',
    filterMarkets: 'اختر الأصول لتحليل التأثير المتوقع عليها',
    expectedImpact: 'الاتجاه المتوقع على السوق',
    aiAnalysisExplanation: 'التحليل الاقتصادي المنطقي',
    readSource: 'قراءة الخبر من المصدر',
    headlineArchive: 'أرشيف العناوين الاقتصادية الكبرى',
    whatHappened: 'ماذا حدث بالضبط؟',
    howItAffected: 'كيف أثر ذلك على الأسواق التي حددتها؟',
    clickToExpand: 'اضغط على عنوان الخبر لعرض تفاصيل التأثير المؤسسي',
    verifiedProvidersPrefix: 'المصادر المفعّلة:',
    verifiedFinancialWire: 'مزودو الأخبار الموثقون',
    officialArchivesPrefix: 'الأرشيف الرسمي:',
    loadingVerifiedWire: 'جارٍ تحميل موجز الأخبار المالية الموثقة...',
    loadingArchivesMsg: 'جارٍ تحميل سجلات السياسة النقدية والإحصائيات الرسمية...',
    noNewsMsg: 'لا توجد أخبار متاحة من مزودي البيانات حالياً.',
    noArchiveMsg: 'لا توجد سجلات أرشيفية متاحة حالياً.',
    macroAssetImpactTitle: 'تحليل التأثير الاقتصادي على الأصول',
    analyzeWithGeminiBtn: 'تحليل التأثير الاقتصادي',
    reanalyzeSelectedBtn: 'إعادة تحليل الأصول المحددة',
    analyzingBtn: 'جارٍ التحليل...',

    giveawaysTitle: 'جوائز YOUNEEL',
    giveawaysSubtitle: 'شارك في السحوبات والجوائز المجتمعية الشفافة المعتمدة من YOUNEEL TRADING.',
    prizePool: 'الجائزة',
    rules: 'الشروط والأحكام الرسمية',
    enterNow: 'شارك في السحب الآن',
    signInToParticipate: 'سجّل الدخول للمشاركة',
    statusActive: 'سحب نشط حالياً',
    statusEnded: 'انتهى السحب',
    publicViewBtn: 'العرض العام',
    adminConsoleBtn: 'إدارة السحوبات',
    newGiveawayBtn: 'إضافة سحب جديد',
    giveawaysUnavailableTitle: 'YOUNEEL GIVEAWAYS قيد التجهيز حالياً',
    giveawaysUnavailableDesc: 'يتم إعداد السحوبات المجتمعية حالياً. يرجى العودة قريباً لمتابعة الفعاليات القادمة.',
    giveawaysUnavailableAdminDesc: 'جداول السحوبات غير مهيأة في قاعدة بيانات المشروع بعد. يرجى تطبيق تهيئة الجداول من لوحة التحكم.',
    noGiveawaysCreated: 'لم يتم إنشاء أي سحب بعد. اضغط على "إضافة سحب جديد" لنشر حملة.',
    noPublishedGiveawaysTitle: 'لا توجد سحوبات منشورة حالياً',
    noPublishedGiveawaysDesc: 'سيتم عرض السحوبات القادمة هنا فور نشرها من الإدارة.',
    loadingGiveaways: 'جارٍ تحميل السحوبات...',
    statusDraft: 'مسودة',
    publishedTag: 'منشور',
    unpublishedTag: 'مسودة غير منشورة',
    endsPrefix: 'ينتهي في:',
    entriesPrefix: 'المشاركات:',
    winnerAnnouncedPrefix: 'الفائز المعلن:',
    winnerPrefix: 'الفائز:',
    participantsBtn: 'المشاركون',
    publishBtn: 'نشر',
    unpublishBtn: 'إلغاء النشر',
    startBtn: 'بدء',
    endBtn: 'إنهاء',
    editLabel: 'تعديل',
    deleteLabel: 'حذف',
    confirmBtn: 'تأكيد',
    enteredStatusPrefix: 'تمت المشاركة • الحالة:',
    participationRecorded: 'تم تسجيل مشاركتك في السحب بنجاح.',
    giveawayCreatedMsg: 'تم إنشاء السحب بنجاح.',
    giveawayUpdatedMsg: 'تم تحديث بيانات السحب.',
    giveawayDeletedMsg: 'تم حذف السحب.',
    enterGiveawayHeading: 'المشاركة في:',
    submittingAsPrefix: 'المشاركة بحساب',
    verificationNoteLabel: 'ملاحظة التحقق أو حساب إنستغرام (اختياري)',
    verificationNotePlaceholder: 'مثال: حساب إنستغرام أو ملاحظة تحقق',
    submittingBtn: 'جارٍ الإرسال...',
    confirmEntryBtn: 'تأكيد المشاركة',
    editGiveawayTitle: 'تعديل السحب',
    createGiveawayTitle: 'إنشاء سحب جديد',
    fieldTitleRequired: 'العنوان *',
    fieldPrizeRequired: 'الجائزة *',
    fieldDescription: 'الوصف',
    fieldRules: 'القوانين وشروط الأهلية',
    fieldImageUrl: 'رابط الصورة (اختياري)',
    fieldStartsAt: 'تاريخ البدء',
    fieldEndsAtRequired: 'تاريخ الانتهاء *',
    fieldStatus: 'الحالة',
    optionDraft: 'مسودة',
    optionActive: 'نشط',
    optionEnded: 'منتهي',
    publishToPublicLabel: 'نشر للعامة',
    saveGiveawayBtn: 'حفظ السحب',
    participantsModalHeading: 'المشاركون',
    noEntriesSubmittedYet: 'لا توجد مشاركات مسجلة حتى الآن.',
    approveTitle: 'قبول',
    rejectTitle: 'رفض',
    selectWinnerBtn: 'تعيين كفائز',

    brokersTitle: 'روابط شركات الوساطة المعتمدة',
    brokersSubtitle: 'روابط رسمية وموثقة لشركات الوساطة المدعومة. يرجى التحقق من الكيان التنظيمي والرسوم ومدى التوافر الإقليمي مباشرة عبر الموقع الرسمي للوسيط.',
    verifiedBrokerBadge: 'بوابات وسطاء رسمية',
    openLiveAccount: 'الانتقال إلى التسجيل الرسمي',
    hfmTagline: 'وسيط عالمي متعدد الأصول والعقود مقابل الفروقات',
    hfmBadge: 'شريك',
    hfmDescription: 'بوابة وساطة مالية عالمية متعددة الأصول.',
    hfmFeatures: [
      'منصتا MetaTrader 4 و MetaTrader 5',
    ],
    tmgmTagline: 'وسيط ECN عالمي متعدد الأصول',
    tmgmBadge: 'شريك',
    tmgmDescription: 'بوابة وساطة مالية عالمية متعددة الأصول.',
    tmgmFeatures: [
      'منصتا MetaTrader 4 و MetaTrader 5',
    ],
    affiliateDisclosure: 'إفصاح الشراكة: توفر YOUNEEL TRADING روابط تسجيل رسمية مع شركتي HFM و TMGM. يدعم التسجيل عبر هذه الروابط استمرار أبحاث المنصة دون أي تكلفة إضافية عليك.',
    riskWarning: 'تحذير المخاطر: تنطوي عقود الفروقات والتداول بالرافعة المالية على درجة عالية من المخاطرة برأس المال وقد لا تكون مناسبة لجميع المستثمرين. لا تتداول بأموال لا يمكنك تحمل خسارتها.',

    contactTitle: 'القنوات الرسمية للتواصل',
    contactSubtitle: 'تواصل مع YOUNEEL TRADING عبر حساباتنا الرسمية على إنستغرام وتيليجرام.',
    connectInstagramHeading: 'تابعنا عبر @youneel.i و @youne_el_i',
    instagramNotice: 'ابقَ على تواصل عبر حسابنا الرسمي على إنستغرام (@youneel.i) وقناتنا على تيليجرام (@youne_el_i) لمتابعة التحليلات اليومية وتحديثات المجتمع.',
    instagramBtn: 'إنستغرام @youneel.i',
    telegramBtn: 'تيليجرام @youne_el_i',
    followHandleAria: 'زيارة الحساب الرسمي ليونيل للتداول على إنستغرام @youneel.i',
    dailyBreakdownsBadge: 'تحليلات يومية',
    giveawayAlertsBadge: 'إعلانات السحوبات والجوائز',
    directInquiriesTitle: 'الاستفسارات المباشرة وشراكات الوسطاء',
    directInquiriesDesc: 'لأي استفسارات حول إدارة المخاطر، أو السحوبات المجتمعية، أو فتح الحسابات مع الوسطاء المعتمدين HFM و TMGM، يرجى التواصل مباشرة عبر الرسائل الخاصة على إنستغرام.',

    institutionalBadge: 'مؤسسي',
    privacyPolicy: 'سياسة الخصوصية',
    termsOfService: 'شروط الخدمة',
    allRightsReserved: 'يونيل للتداول (YOUNEEL TRADING). جميع الحقوق محفوظة.',
    paperTradingNote: 'كافة الصفقات في سجل التداول هي صفقات تجريبية (Paper Trading) محمية بعزل تام لكل حساب. المحتوى تعليمي بحت ولا يمثل نصيحة مالية.',
    privacyClause1Title: '1. عزل وخصوصية الحسابات:',
    privacyClause1Body: 'تُحفظ إعدادات رأس المال وسجل صفقاتك الخاصة في بيئة سحابية معزولة وبصلاحيات وصول صارمة لكل مستخدم بحيث لا يطّلع على بياناتك سواك.',
    privacyClause2Title: '2. جمع المعلومات:',
    privacyClause2Body: 'عند التسجيل بالبريد الإلكتروني وكلمة المرور، نحتفظ فقط بمعرف المصادقة وبريدك الإلكتروني. لا نطلب بطاقات بنكية أو كلمات مرور شركات الوساطة الحقيقية.',
    privacyClause3Title: '3. مسح البيانات النهائي:',
    privacyClause3Body: 'تحتفظ بالتحكم الكامل في بياناتك ويمكنك حذف ملفك الشخصي وسجل صفقاتك نهائياً في أي وقت عبر زر "حذف حسابي وبياناتي".',
    privacyClause4Title: '4. مزودو الأسعار والأمان:',
    privacyClause4Body: 'تُجلب أسعار الأسواق الحية عبر خوادم وسيطة آمنة دون إرسال أي بيانات شخصية خاصة بك إلى مزودي البيانات المالية.',
    termsClause1Title: '1. تداول تجريبي (Paper Trading) فقط:',
    termsClause1Body: 'تم تصميم سجل التداول وأدوات الأوامر في YOUNEEL TRADING للمحاكاة التعليمية وإدارة المخاطر فقط، ولا يتم تنفيذ أي أموال حقيقية عبر المنصة.',
    termsClause2Title: '2. ليست نصيحة مالية:',
    termsClause2Body: 'جميع المؤشرات الفنية ومستويات السعر وتقارير التحيز اليومي وتحليلات الأخبار هي لأغراض تعليمية وبحثية ولا تُعد توصية استثمارية أو مالية.',
    termsClause3Title: '3. تحذير المخاطر:',
    termsClause3Body: 'ينطوي تداول العملات الأجنبية والذهب والمؤشرات والعملات الرقمية بالرافعة المالية على مخاطر مرتفعة ولا يناسب جميع المستثمرين.',
    termsClause4Title: '4. شراكات شركات الوساطة:',
    termsClause4Body: 'يتم فتح الحسابات الحقيقية لدى الشركات الموصى بها (HFM، TMGM) بشكل مستقل عبر مواقعها المرخصة ووفق شروطها الرقابية.',

    proprietaryBadge: 'تحليل خاص — YOUNEEL TRADING',
    copyNoticeToast: 'تحليل خاص بمنصة YOUNEEL TRADING — النسخ غير متاح لهذا القسم.',

    ownerStudioLabel: 'استوديو المالك',
    featuredCompetitionsTitle: 'مسابقات الوسطاء المميزة',
    featuredCompetitionsDesc: 'مسابقات تداول رسمية وموثقة من شركات الوساطة الشريكة، ومنفصلة تماماً عن جوائز YOUNEEL.',
    viewAllCompetitionsBtn: 'عرض جميع المسابقات',
    competitionsTitle: 'مسابقات الوسطاء',
    competitionsSubtitle: 'مسابقات التداول الرسمية وجوائز المتداولين المعتمدة من TMGM و HFM وشركاء الوساطة. قسم مستقل تماماً عن جوائز YOUNEEL.',
    allBrokersFilter: 'جميع الوسطاء',
    allStatusesFilter: 'جميع الحالات',
    searchCompetitionsPlaceholder: 'ابحث في المسابقات أو الجوائز أو الشروط...',
    noCompetitionsTitle: 'لا توجد مسابقات وسطاء موثقة حالياً',
    noCompetitionsDesc: 'تتم مراقبة المصادر الرسمية تلقائياً. ستظهر المسابقات الموثقة هنا فور اعتمادها والتحقق منها.',
    officialBrokerContest: 'مسابقة وسيط رسمية',
    accountsLabel: 'حساباً مشاركاً',
    verifiedPrefix: 'تم التحقق',
    compPotentiallyOutdatedNotice: 'تعذر الوصول للمصدر الرسمي في آخر فحص مجدول. يتم عرض آخر بيانات موثقة محفوظة.',
    compRegDeadlineLabel: 'آخر موعد للتسجيل',
    compDatesLabel: 'فترة المسابقة',
    compEligibilityLabel: 'شروط الأهلية',
    compRequirementsLabel: 'متطلبات التداول',
    participateOfficialBtn: 'المشاركة عبر الموقع الرسمي',
    officialSourceLinkLabel: 'المصدر الرسمي',
    officialRulesLabel: 'شروط المسابقة',
    compStatusLive: 'مباشرة الآن',
    compStatusRegOpen: 'التسجيل مفتوح',
    compStatusUpcoming: 'قادمة',
    compStatusEndingSoon: 'تنتهي قريباً',
    compStatusCompleted: 'مكتملة',
    compStatusExpired: 'منتهية',
    compStatusUnverified: 'بانتظار التحقق',
    brokerSourcesNote: 'تراقب الخدمة تلقائياً المصادر الرسمية لـ TMGM و HFM دون اختلاق أي مسابقات أو تصنيف عروض الكاش باك كمسابقات.',

    statusPaused: 'متوقفة مؤقتاً',
    statusScheduled: 'مجدولة',
    statusArchived: 'مؤرشفة',
    previewPlaceholderTitle: 'عنوان الجائزة التجريبي',
    previewPlaceholderPrize: 'جائزة تداول بقيمة $1,000',
    mediaUploadHeading: 'صورة المسابقة وأداة القص والتمركز',
    dragToReposition: 'اسحب الصورة لضبط نقطة التمركز',
    selectImageFromComputer: 'ارفع صورة JPG أو PNG أو WEBP أو AVIF (الحد الأقصى 5 ميجابايت)',
    chooseImageFileBtn: 'اختيار صورة',
    cropAndUploadBtn: 'قص ورفع للتخزين السحابي',
    uploadingImageLabel: 'جارٍ الرفع...',
    imageUploadedSuccess: 'تم قص الصورة ورفعها بأمان إلى التخزين السحابي.',
    uploadMimeError: 'يُسمح فقط بصور JPG أو PNG أو WEBP أو AVIF.',
    uploadSizeError: 'يجب ألا يتجاوز حجم الصورة 5 ميجابايت.',
    uploadFailedFallback: 'تعذر رفع الصورة. يمكنك لصق رابط صورة HTTPS موثق بالأسفل.',

    ownerStudioTitle: 'لوحة المالك الخاصة — YOUNEEL',
    ownerStudioSubtitle: 'مركز التحكم الحصري والمحمي لإدارة جوائز YOUNEEL ومسابقات الوسطاء وسجل الأمان.',
    ownerGateTitle: 'تسجيل دخول المالك والتحقق الثنائي',
    ownerGateDesc: 'قم بتسجيل الدخول ببيانات المالك المعتمدة، ثم أكمل التحقق عبر رمز البريد الإلكتروني الصالح لمرة واحدة لمدة 5 دقائق.',
    ownerOtpHeading: 'مطلوب رمز التحقق عبر البريد الإلكتروني',
    ownerOtpDesc: 'أدخل رمز التحقق المكون من 6 أرقام المرسل إلى بريد المالك المسجل. تنتهي صلاحية الرمز خلال 5 دقائق.',
    ownerOtpPlaceholder: 'رمز التحقق (6 أرقام)',
    requestOtpBtn: 'إرسال رمز التحقق',
    verifyOtpBtn: 'تأكيد الرمز وفتح لوحة المالك',
    verifyingOtpBtn: 'جارٍ التحقق...',
    resendOtpBtn: 'إعادة إرسال الرمز',
    otpSentNotice: 'تم إرسال رمز التحقق إلى بريد المالك. الرمز صالح لمدة 5 دقائق فقط.',
    otpDeliveryMissingTitle: 'خدمة إرسال البريد غير مهيأة على الخادم',
    otpDeliveryMissingDesc: 'يرجى ضبط متغيرات SMTP أو RESEND_API_KEY على الخادم لتفعيل إرسال رموز التحقق ذات الاستخدام الواحد.',
    unauthorizedOwnerTitle: 'منطقة مقيدة للمالك فقط',
    unauthorizedOwnerDesc: 'الدخول إلى وضع المالك محصور حصرياً بحساب المالك الموثق من الخادم.',
    returnHomeBtn: 'العودة إلى المنصة',
    lockOwnerSessionBtn: 'قفل الجلسة',
    ownerTabGiveaways: 'منشئ الجوائز',
    ownerTabCompetitions: 'مسابقات الوسطاء',
    ownerTabSecurity: 'الأمان والسجلات',
    builderTabContent: '1. المحتوى والروابط',
    builderTabMedia: '2. الصورة والقص',
    builderTabDesign: '3. القالب والألوان',
    builderTabSchedule: '4. النشر والجدولة',
    builderLivePreview: 'معاينة مباشرة للبطاقة',
    saveDraftBtn: 'حفظ كمسودة',
    publishNowBtn: 'نشر الآن',
    scheduleBtn: 'جدولة النشر',
    duplicateBtn: 'نسخ',
    pauseBtn: 'إيقاف مؤقت',
    archiveBtn: 'أرشفة',
    unarchiveBtn: 'استعادة',
    fieldSubtitle: 'عنوان فرعي ترويجي',
    fieldCtaLabel: 'نص زر المشاركة المخصص',
    fieldExternalUrl: 'رابط مشاركة خارجي (اختياري)',
    fieldPublishAt: 'موعد النشر المجدول',
    designTemplateLabel: 'قالب التصميم البصري',
    colorBgLabel: 'لون الخلفية',
    colorSurfaceLabel: 'لون صندوق الجائزة',
    colorAccentLabel: 'اللون المميز',
    colorTextLabel: 'لون النص',
    fontPresetLabel: 'نمط الخط',
    cornerRadiusLabel: 'استدارة الحواف',
    fontSansLabel: 'خط حديث نظيف',
    fontSerifLabel: 'خط تحريري كلاسيكي',
    fontCondensedLabel: 'خط عرض تداولي بارز',
    fontArabicLabel: 'خط IBM العربي',
    compQueueHeading: 'قائمة مراجعة المالك',
    compAllHeading: 'جميع مسابقات الوسطاء المتعقبة',
    compAddManualBtn: 'إضافة مسابقة موثقة',
    compSyncNowBtn: 'فحص المصادر الرسمية الآن',
    compSyncingBtn: 'جارٍ فحص المواقع الرسمية...',
    compApprovePublishBtn: 'اعتماد ونشر',
    compRejectBtn: 'رفض',
    compFeatureHomeBtn: 'تمييز في الرئيسية',
    compUnfeatureHomeBtn: 'إلغاء التمييز',
    compAddBrokerBtn: 'إضافة مصدر وسيط جديد',
    discoveryLogsHeading: 'سجلات الجدولة التلقائية لاكتشاف المسابقات',
    notificationsHeading: 'تنبيهات المالك وتحديثات المسابقات',
    markAllReadBtn: 'تحديد الكل كمقروء',
    auditLogsHeading: 'سجل الأمان وإجراءات المالك',
    schedulerStatusHeading: 'المجدول الخلفي لاكتشاف المسابقات',
    emailDeliveryHeading: 'ناقل التحقق الثنائي عبر البريد',
    compBrokerLabel: 'الوسيط',
    compPrizePoolLabel: 'إجمالي الجوائز',
    compPrizeDetailsLabel: 'تفاصيل وتوزيع الجوائز',
    compOfficialSourceLabel: 'رابط المصدر الرسمي',
    compOfficialRegLabel: 'رابط التسجيل الرسمي',
    compRulesUrlLabel: 'رابط الشروط والقوانين',
    compRegStartLabel: 'بداية التسجيل',
    compRegEndLabel: 'نهاية التسجيل',
    compStartLabel: 'بداية المسابقة',
    compEndLabel: 'نهاية المسابقة',
    compEligibilityInputLabel: 'ملخص الأهلية والشروط',
    compTradingReqInputLabel: 'متطلبات حجم التداول والأيام',
    compStatusInputLabel: 'حالة المسابقة',
    saveCompetitionBtn: 'حفظ المسابقة',
    brokerSlugPlaceholder: 'معرّف الوسيط (مثال: pepperstone)',
    brokerNamePlaceholder: 'اسم الوسيط',
    brokerSitePlaceholder: 'رابط الموقع الرسمي',
    brokerSourcePlaceholder: 'رابط صفحة المسابقات الرسمية',
    ownerDiagHeading: 'تشخيص مصادقة المالك والأمان',
    ownerDiagSubtitle: 'فحوصات تحقق حية على الخادم (دون كشف أي مفاتيح سرية أو كلمات مرور).',
    diagSupabaseAuth: 'مصادقة Supabase',
    diagUserId: 'معرّف المستخدم المصادق',
    diagOwnerRole: 'حالة دور المالك',
    diagEmailVerify: 'التحقق عبر البريد (OTP)',
    diagEmailDelivery: 'تهيئة ناقل البريد',
    diagSessionValid: 'صلاحية جلسة المالك',
    diagAuthResult: 'نتيجة الصلاحية النهائية',
    ownerProvisionToggle: 'أول مرة؟ تهيئة حساب المالك الحصري',
    ownerProvisionBackToSignIn: 'لديك حساب مهيأ؟ تسجيل الدخول',
    ownerProvisionBtn: 'تهيئة حساب المالك',
    ownerProvisionDesc: 'يسجّل البريد الحصري للمالك في Supabase Auth مع بقاء التحقق الثنائي وصلاحية الخادم إلزاميين.',
    ownerResendCooldownPrefix: 'إعادة الإرسال متاحة خلال',
    refreshBtn: 'تحديث',

    giveawaySponsorLabel: 'الراعي',
    entriesSuffix: 'مشاركة',
    giveawayEligibilityLabel: 'معايير الأهلية',
    giveawayCountryRestrictionsLabel: 'القيود الجغرافية',
    giveawayCapacityFull: 'اكتمل العدد',
    giveawayMaxParticipantsLabel: 'الحد الأقصى للمشاركين (اختياري)',
    giveawayDiagnosticsTitle: 'تشخيص نظام السحوبات الخلفي',
    diagTablesLabel: 'الجداول',
    diagPermissionsLabel: 'الصلاحيات',
    diagStorageLabel: 'حاوية التخزين',
    diagAuthLabel: 'المصادقة',
    diagOtherDbLabel: 'فحوصات أخرى',
    diagSqlActionPrompt: 'نفّذ ملف الترحيل SQL التالي في Supabase SQL Editor ثم اضغط تحديث التشخيص:',
    markCompletedBtn: 'تعيين كمكتمل',
    giveawaysGroupActive: 'السحوبات النشطة حالياً',
    giveawaysGroupUpcoming: 'السحوبات القادمة',
    giveawaysGroupCompleted: 'السحوبات المكتملة والسابقة',
    giveawaysSchemaMissingTitle: 'مطلوب تهيئة جداول السحوبات في قاعدة البيانات',

    brokerSpecsHeading: 'مواصفات الحسابات والتنفيذ المعتمدة',
    brokerFactVerified: 'مواصفات موثقة من الوسيط',
    brokerFactConfirm: 'يرجى تأكيد الشروط الإقليمية عبر البوابة الرسمية',

    contactSuccessMsg: 'تم إرسال رسالتك بنجاح. سيقوم فريقنا بمراجعتها قريباً.',
    contactNameLabel: 'الاسم الكامل',
    contactNamePlaceholder: 'أدخل اسمك الكامل',
    contactSubjectLabel: 'الموضوع',
    contactSubjectPlaceholder: 'التعليم، فتح حساب وسيط، أو دعم السحوبات',
    contactMessageLabel: 'الرسالة',
    contactMessagePlaceholder: 'اكتب رسالتك بوضوح...',
    contactSendBtn: 'إرسال الرسالة',

    homeDailyBiasHeading: 'التحيز اليومي لجلسة نيويورك',
    viewAllGiveawaysBtn: 'عرض جميع السحوبات',
    homeLatestNewsHeading: 'أحدث عناوين الأخبار المالية',
    homeNewsUnavailableNotice: 'مزود الأخبار المالية الحية غير متاح مؤقتاً.',

    maxDrawdownLabel: 'أقصى تراجع (Drawdown)',
    journalSearchPlaceholder: 'ابحث في الملاحظات أو الاستراتيجية أو الرمز...',
    journalStrategyLabel: 'الاستراتيجية / النموذج',
    allStrategiesFilter: 'جميع الاستراتيجيات',
    journalEmotionsLabel: 'الحالة النفسية أثناء التنفيذ',
    journalEntryReasonLabel: 'مبرر الدخول',
    journalExitReasonLabel: 'مبرر الخروج',
    journalMistakesLabel: 'الدروس والأخطاء',
    journalScreenshotLabel: 'رابط أو رفع صورة التحليل',
    editJournalTitle: 'تعديل مذكرات الصفقة',
    saveJournalBtn: 'حفظ المذكرات',

    ownerTabOverview: 'نظرة عامة',
    ownerTabUsers: 'المستخدمون والاستفسارات',
    ownerOverviewHeading: 'مؤشرات المنصة العامة',
    metricUsersLabel: 'المستخدمون المسجلون',
    metricTradesLabel: 'الصفقات المسجلة',
    metricGiveawaysLabel: 'السحوبات',
    metricParticipantsLabel: 'مشاركات السحوبات',
    metricCompetitionsLabel: 'مسابقات الوسطاء',
    metricInquiriesLabel: 'استفسارات التواصل',
    ownerUsersHeading: 'حسابات المتداولين المسجلة والأدوار',
    setTraderRoleBtn: 'تعيين كمتداول',
    setAdminRoleBtn: 'تعيين كمشرف',
    ownerInquiriesHeading: 'رسائل واستفسارات التواصل الواردة',
    noInquiriesYet: 'لا توجد رسائل تواصل مرسلة بعد.',

    brokerOfficialDomain: 'الموقع الرسمي',
    brokerVerifyDirectNote: 'يرجى التحقق دائماً من الجهة الرقابية المنطبقة وجدول الرسوم وتوافر الخدمات في بلدك مباشرة عبر بوابة الوسيط الرسمية قبل فتح الحساب.',

    tabMacroEvents: 'البيانات الاقتصادية الأمريكية (CPI • FOMC • PPI • NFP)',
    relatedInstrumentsLabel: 'الأسواق المرتبطة',
    freshLiveBadge: 'مباشر',
    freshRecentBadge: 'حديث',
    freshArchiveBadge: 'أرشيف',
    allCategoriesFilter: 'جميع التصنيفات',

    modeTechnicalBias: 'التحيز الفني اليومي',
    modeFundamentalMacro: 'التحليل الأساسي (CPI / FOMC / PPI / NFP)',
    fundamentalTitle: 'التحليل الأساسي المؤسسي للاقتصاد الكلي',
    fundamentalSubtitle: 'متابعة مباشرة لإصدارات الاحتياطي الفيدرالي ومكتب إحصاءات العمل الأمريكي وFRED عبر مرحلتي ما قبل الصدور وما بعد الصدور مع ربط الأصول الثمانية بالتحليل الفني.',
    stageBeforeLabel: 'المرحلة 1: تحليل ما قبل الصدور (محفوظ)',
    stageAfterLabel: 'المرحلة 2: تحليل ما بعد الصدور (الأرقام الفعلية والمراجعات)',
    nextReleaseLabel: 'الموعد القادم المجدول',
    latestReleaseLabel: 'أحدث إصدار رسمي',
    actualLabel: 'القراءة الفعلية',
    forecastLabel: 'توقعات الإجماع',
    previousLabel: 'القراءة السابقة',
    revisionLabel: 'المراجعة',
    dataUnavailableLabel: 'البيانات غير متوفرة',
    policyImplicationLabel: 'أثر السياسة النقدية والأسواق',
    reportBreakdownLabel: 'تفصيل التقرير الرسمي',
    statementDiffLabel: 'تغييرات بيان الفيدرالي والإشارات النقدية',
    assetImpactMatrixLabel: 'مصفوفة التأثير على الأصول الثمانية',
    transmissionMechanismLabel: 'آلية انتقال الأثر',
    invalidationLabel: 'شروط إبطال السيناريو',
    techConnectionLabel: 'التحليل الأساسي مقابل الفني',
    postReactionLabel: 'رد فعل السعر بعد الصدور',
    sourceAttributionLabel: 'إسناد المصادر الموثوقة (4 مستويات)',
    officialFactsTier: '1. الحقائق الاقتصادية الرسمية',
    marketExpectationsTier: '2. توقعات السوق والإجماع',
    publishedSourcesTier: '3. المصادر الرسمية المنشورة',
    interpretationTier: '4. التفسير التحليلي',
    bullishScenarioLabel: 'السيناريو الإيجابي',
    bearishScenarioLabel: 'السيناريو السلبي',
    neutralScenarioLabel: 'السيناريو المحايد / المطابق للتوقعات',
    uncertaintyFactorsLabel: 'عوامل عدم اليقين الرئيسية',
    mixedReportFlagLabel: 'تقرير متباين الإشارات — تجنّب التبسيط الأحادي',
    allEventsTimelineLabel: 'الجدول الزمني والأرشيف الاقتصادي',
    ownerFundamentalHeading: 'تشخيص ومزامنة مصادر التحليل الأساسي',
    ownerFundamentalSyncBtn: 'مزامنة المصادر الاقتصادية الآن',
    fundamentalAlignBannerTitle: 'تقاطع التحليل الأساسي مع التحيز الفني',
    fundamentalViewBtn: 'استعراض التقرير الأساسي الكامل',
    technicalViewBtn: 'الانتقال للتحليل الفني',

    instagramChannelTitle: 'إنستغرام (Instagram)',
    instagramChannelDesc: 'تحليلات يومية للرسوم البيانية، وتحديثات الجلسات، والمناطق السعرية الرئيسية مباشرة عبر حسابنا الرسمي على إنستغرام.',
    openInstagramBtn: 'فتح إنستغرام',
    telegramChannelTitle: 'تيليجرام (Telegram)',
    telegramChannelDesc: 'تنبيهات البيانات الاقتصادية، وتحديثات الأسواق المباشرة، وإعلانات المجتمع عبر قناتنا الرسمية على تيليجرام.',
    openTelegramBtn: 'فتح تيليجرام',
    telegramHandleAria: 'تواصل معنا عبر تيليجرام @youne_el_i',
    marketFilterAll: 'جميع الأسواق',
    marketFilterGold: 'الذهب (GOLD)',
    marketFilterIndices: 'ناسداك والمؤشرات الأمريكية',
    marketFilterForex: 'العملات (FOREX)',
    marketFilterCrypto: 'العملات الرقمية (CRYPTO)',
    marketFilterOil: 'النفط والسلع',
    marketFilterMacro: 'الاقتصاد الأمريكي / الماكرو',
    assetFilterAll: 'جميع الأصول',
    impactHigh: 'تأثير مرتفع',
    impactMedium: 'تأثير متوسط',
    impactLow: 'موجز سوقي',
    noMarketNewsTitle: 'لا توجد أخبار موثقة لهذا الفلتر حالياً',
    noMarketNewsDesc: 'لم تتوفر تقارير إخبارية موثقة تطابق السوق أو الأصل المحدد ضمن النطاق الزمني النشط. يمكنك العودة إلى جميع الأسواق أو التحديث لاحقاً.',
    resetMarketFiltersBtn: 'عرض جميع الأسواق',
    openMacroBreakdownBtn: 'فتح تحليل CPI و FOMC و PPI و NFP',
    macroReleaseConnectedLabel: 'مرتبط ببيان اقتصادي أمريكي',
  },
};

export function tr(lang: Language, key: keyof Translations): string {
  const dict = translations[lang];
  const val = dict[key];
  if (
    val === undefined ||
    val === null ||
    (typeof val === 'string' && val.trim() === '')
  ) {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
      console.warn(`[i18n] Missing translation key "${String(key)}" for locale "${lang}"`);
    }
    const fallback = translations.en[key];
    return typeof fallback === 'string' ? fallback : String(key);
  }
  return typeof val === 'string' ? val : String(key);
}

export function translateFreshness(freshness: string | undefined, isLive: boolean | undefined, fallbackUsed: boolean | undefined, lang: Language): string {
  const t = translations[lang];
  if (freshness === 'disconnected') return t.statusDisconnected;
  if (!freshness || freshness === 'unavailable') return t.statusUnavailable;
  if (isLive && freshness === 'live' && !fallbackUsed) return t.statusLive;
  if (freshness === 'market_closed') return t.statusMarketClosed;
  if (freshness === 'stale') return t.statusStale;
  return t.statusDelayed;
}

export function translateApiError(rawMsg: string | undefined | null, lang: Language): string {
  if (!rawMsg) return lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'Unexpected error occurred.';
  if (lang === 'en') return rawMsg;

  const lower = rawMsg.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (lower.includes('user already registered')) return 'هذا البريد الإلكتروني مسجل مسبقاً.';
  if (lower.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً عبر رابط التفعيل المرسل إليك.';
  if (lower.includes('password should be at least')) return 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.';
  if (lower.includes('authentication required')) return 'يرجى تسجيل الدخول للمتابعة.';
  if (lower.includes('rate limit')) return 'تم الوصول لحد الطلبات المؤقت لمزود البيانات. جارٍ المحاولة تلقائياً.';
  if (lower.includes('insufficient free margin')) return 'الهامش المتاح غير كافٍ لفتح هذه الصفقة.';
  if (lower.includes('insufficient account balance')) return 'رصيد الحساب غير كافٍ لفتح صفقات جديدة.';
  if (lower.includes('invalid buy levels')) return 'مستويات الشراء غير صالحة مقابل السعر الحي الحالي: يجب أن يكون SL أقل من السعر و TP أعلى من السعر.';
  if (lower.includes('invalid sell levels')) return 'مستويات البيع غير صالحة مقابل السعر الحي الحالي: يجب أن يكون SL أعلى من السعر و TP أقل من السعر.';
  if (lower.includes('stop loss and take profit must be positive')) return 'يجب أن تكون قيم وقف الخسارة وأخذ الربح موجبة وصحيحة.';
  if (lower.includes('risk % must be between')) return 'يجب أن تتراوح نسبة المخاطرة بين 0.1% و 10%.';
  if (lower.includes('already entered this giveaway')) return 'لقد قمت بالمشاركة في هذا السحب مسبقاً.';
  if (lower.includes('giveaway is not currently accepting entries')) return 'هذا السحب لا يستقبل مشاركات جديدة في الوقت الحالي.';
  if (lower.includes('gemini') || lower.includes('ai macro impact')) return 'خدمة التحليل بالذكاء الاصطناعي غير متوفرة حالياً مؤقتاً.';
  if (lower.includes('live market quote unavailable')) return 'تعذر جلب السعر الحي الموثق من مزود البيانات حالياً.';
  if (lower.includes('administrator privileges')) return 'هذا الإجراء متاح للإدارة فقط.';
  if (lower.includes('unable to reach verified news')) return 'تعذر الوصول إلى مزودي الأخبار الموثقين حالياً.';
  return rawMsg;
}
