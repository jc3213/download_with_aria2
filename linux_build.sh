#!/bin/bash
exists()
{
   command -v "$1" >/dev/null 2>&1
}
get_json_value()
{
     if [ "$3" == "text" ];then
        grep -oE "\"$2\": \"[^\"]*" "$1" | grep -oE '[^"]*$'
    elif [ "$3" == "id" ];then
        grep -oE "\"$2\": [0-9]+" "$1" | grep -oE '[0-9]+'
    fi
}
if [ "$1" == "chromium" ];then 
   num="1"
elif [ "$1" == "firefox" ];then	  
   num="2"
elif [ "$1" == "" ];then
   echo "Auto build script for extension <Download with Aria2>"
   echo 1. Chromium
   echo 2. Firefox
   echo -n "Build for "
   read -r num
else
   echo "input error,end execution"
   exit
fi
script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
if [ "$num" == "1" ];then
   code="chromium"
elif [ "$num" == "2" ];then
   code="firefox"
else
   echo "input error,end execution"
   exit
fi 
echo "$code"
maincode_dir="$script_dir/chromium"
build_dir="$script_dir/build/$code"
code_dir="$script_dir/$code"
manifestPath="$code_dir/manifest.json"
if [ ! -d "$build_dir" ]; then
		mkdir -p "$build_dir"
fi
if ! exists zip; then 
   echo "NOT EXIST zip,exit" 
   exit
fi
if [ "$num" == "1" ];then 
   suffix="crx"
elif [ "$num" == "2" ];then   
   suffix="xpi"
fi
version="$(get_json_value "$manifestPath" version text)"
addFileName="$version.$suffix"
addPath="$build_dir/$addFileName"
if [  -f "$addPath" ]; then
   rm -f "$addPath"
fi
if [ "$num" == "2" ];then
   cd "$maincode_dir" || exit
   zip  -r "$addPath" ./*
   cd "$script_dir" || exit
fi
cd "$code_dir" || exit
zip  -r "$addPath" ./*
if  exists firefox-developer-edition ; then 
   if [ "$2" == "-i" ];then 
      firefox-developer-edition "$addPath"
   fi
fi
echo "the end"
