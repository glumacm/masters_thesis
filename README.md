# Masters thesis - A software component for data synchronization between a web client and a backend system
This project will include source code related to my Masters Thesis on masters course at University of Ljubljana at Faculty of Computer and information science.

## Warning
The software available in this repository is an implementation of a synchronization process. We tried to create a research like work that would help us check if we can provide generic solution for sycnhronization. This is research based software and solution. Current state of the software is not meant to be used as commercial and production ready software. But is a software than can give develoeprs an idea or base when adding synchronization to their pre-existing TypeScript and PHP related projects. 

## Structure
Repository is divided into three folders: 
* frontend -> where we added all the logic for the synchronization process that should happen on the client side (browser/PWA application) written in TypeScript. There is a core logic/code inside this folder that could be reused in any TypeScript application, but since we wanted to know if logic works flawlessly in at least one framework, we decided to include base logic inside an Angular application.
* backend -> all the logic/code that is necessary for generic synchronization process inside PHP+Symfony projects.
* simulations -> includes exported Dexie databases from our tests scenarios in our simulations, which were used for analysis in the masters thesis.