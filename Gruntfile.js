var grunt = require('grunt');

grunt.config.init({
    pkg: grunt.file.readJSON('./package.json'),
    'create-windows-installer': {
        ia32: {
            appDirectory: './Downloader-win32-x64',
            outputDirectory: './installer64',
            authors: 'Samuel',
            title: 'Downloader',
            exe: 'Downloader.exe',
            description: 'nHentai downloader',
            noMsi: true,
            loadingGif: 'installing.gif',
            setupIcon: 'setup.ico',
            icon: 'icon.ico',
        }
    }
})

grunt.loadNpmTasks('grunt-electron-installer');
grunt.registerTask('default', ['create-windows-installer']);
