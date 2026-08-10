-- ============================================================
-- Database Cleanup Script for ignito_experia
-- Removes 34 deprecated / extra legacy tables
-- ============================================================

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `aboutmain_section`;
DROP TABLE IF EXISTS `admins`;
DROP TABLE IF EXISTS `blogs`;
DROP TABLE IF EXISTS `career_applications`;
DROP TABLE IF EXISTS `career_emails`;
DROP TABLE IF EXISTS `company_highlights`;
DROP TABLE IF EXISTS `contact_faq_section`;
DROP TABLE IF EXISTS `contact_faqs`;
DROP TABLE IF EXISTS `contact_messages`;
DROP TABLE IF EXISTS `contact_page_info`;
DROP TABLE IF EXISTS `contact_us_emails`;
DROP TABLE IF EXISTS `data_security_section`;
DROP TABLE IF EXISTS `gallery`;
DROP TABLE IF EXISTS `hero_associate`;
DROP TABLE IF EXISTS `herosectionmaster`;
DROP TABLE IF EXISTS `homeaboutmaster`;
DROP TABLE IF EXISTS `homehelpsectionmaster`;
DROP TABLE IF EXISTS `homesoftware`;
DROP TABLE IF EXISTS `our_associate`;
DROP TABLE IF EXISTS `permissiongroups`;
DROP TABLE IF EXISTS `pricing_inquiries`;
DROP TABLE IF EXISTS `pricing_inquiry_emails`;
DROP TABLE IF EXISTS `pricing_models`;
DROP TABLE IF EXISTS `pricing_section`;
DROP TABLE IF EXISTS `services`;
DROP TABLE IF EXISTS `software_section_images`;
DROP TABLE IF EXISTS `software_section_master`;
DROP TABLE IF EXISTS `sub_services`;
DROP TABLE IF EXISTS `team_members`;
DROP TABLE IF EXISTS `team_sections`;
DROP TABLE IF EXISTS `testimonialmastertable`;
DROP TABLE IF EXISTS `userpermissions`;
DROP TABLE IF EXISTS `webdetailsmaster`;
DROP TABLE IF EXISTS `whychosseusmaster`;

SET FOREIGN_KEY_CHECKS = 1;
