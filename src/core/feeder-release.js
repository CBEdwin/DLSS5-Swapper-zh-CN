'use strict';

// One verified release for the shader, both client architectures and helper.
// Never mix host protocol versions: 1.17.0 speaks IPC v11, and a 1.16.x or
// 1.17.0-beta.1 half refuses to talk to it. Both halves ship from this pin, so
// a payload built from here is always a matched pair. Digest supplied by
// GitHub's release API.
module.exports = {
  version: '1.17.0',
  archive: ['DLSS5-Feeder-1.17.0.zip', 'https://github.com/jlrouzies-fr/DLSS5-Feeder/releases/download/v1.17.0/DLSS5-Feeder-1.17.0.zip', '11a96b36ae89ef75b3cff0e03849db35591143fe4df171986502905809469e12'],
  // The overlay pins dlss5-feed.addon64 by size and digest before it will
  // drive Feeder's sliders, so the number lives here too and a build-time
  // check holds the two in step. #225 was this pin going stale unnoticed.
  addon64Size: 329728,
  hashes: {
    'dlss5-feed.addon32': 'bfe24218be719cf5b91d829283953432907922333280931b755d83ac793fd8b2',
    'dlss5-feed.addon64': '6854d012eac307021cd31c978bafd42f1e22c5b7b2922c80e0a0010d428a3fd7',
    'dlss5-feed-host64.exe': 'c835754277a0590780d846443f314a83a30e2d2815ee0b2f7c18f1a24f252936',
    'reshade-shaders/Shaders/DLSS5_Feed.fx': 'c4ba1610df8e1593faa7c203d6d0517058d3a8ecf2dfda18ca67849844391456',
    // Feeder's own loader layer. A Vulkan game whose driver does not expose
    // the KHR external-interop extensions needs it for one launch.
    'layer-x64/VkLayer_feed_vk.dll': 'ed5978fff1ac1b2c85aed7b1ffe2c7668e2be71f5a8cff86b4327bfa1d959a28',
    'layer-x64/VkLayer_feed_vk.json': 'c15967b3f8847a145e21058a1e57e92c595ee17fc5dd23ab3278b0148ad6e9d1',
    'layer-x64/run-with-feed-layer.bat': 'bc9aa7964742e23653556be978f540f503f3cef928b6de7a38f77c570bb764f9',
    'layer-x86/VkLayer_feed_vk32.dll': 'cbb3039e13ce1a851c00bba24a93586ea8d9731dad3fcf426f412cc764a61860',
    'layer-x86/VkLayer_feed_vk32.json': '28f8174eb8fed02266bafa6910eab07922ec6d2bdb33110699c586f74b254921',
    'layer-x86/run-with-feed-layer32.bat': '75d4584ad01619402a10e0d8342b114613057a1d3b0ac8dbe9280b740090c3e8'
  }
};
