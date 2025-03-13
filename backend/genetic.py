
import numpy as np
from itertools import chain

class GeneticVRP:
    def __init__(self):
        self.running = False
        # New selection settings and final destination.
        self.config = {
            'num_cities': 25,
            'pop_size': 100,
            'mutation_rate': 0.02,
            'selection_method': 'tournament',
            'crossover_method': 'ox',
            'mutation_method': 'swap',
            'elite_percentage': 10,
            'elitism': True,
            'final_index': None  # If None, treat as cycle; otherwise, use as fixed final city.
        }
        self.start_index = 0
        self.reset()
        
    def reset(self):
        self.cities = np.random.rand(self.config['num_cities'], 2)
        self.start_index = 0
        # If final_index is not set, default to start_index (cycle).
        if self.config['final_index'] is None:
            self.config['final_index'] = self.start_index
        self.population = self.initialize_population()
        self.generation = 0

    def set_cities(self, cities, depot, final=None):
        # 'depot' carries the start city index.
        self.cities = np.array(cities)
        self.config['num_cities'] = len(cities)
        self.start_index = int(depot)
        # Set final_index if provided; otherwise, default to start_index.
        if final is not None:
            self.config['final_index'] = int(final)
        else:
            self.config['final_index'] = self.start_index
        self.population = self.initialize_population()
        self.generation = 0

    def initialize_population(self):
        return [np.array(np.random.permutation(self.config['num_cities'])).flatten().astype(int)
                for _ in range(self.config['pop_size'])]

    def _reproduce(self, parent1, parent2):
        crossover_map = {
            'ox': self.ox_crossover,
            'cycle': self.cycle_crossover,
            'sp': self.single_point_crossover
        }
        crossover_fn = crossover_map.get(self.config['crossover_method'], self.ox_crossover)
        mutation_map = {
            'swap': self.swap_mutate,
            'inversion': self.inversion_mutate
        }
        mutation_fn = mutation_map[self.config['mutation_method']]
        child = mutation_fn(crossover_fn(parent1, parent2))
        return np.array(child).flatten()

    def evolve(self, mutation_rate=None, selection_method=None):
        if mutation_rate is not None:
            self.config['mutation_rate'] = mutation_rate
        if selection_method is not None:
            self.config['selection_method'] = selection_method

        fitness = np.array([self.calculate_distance(ind) for ind in self.population])
        sorted_indices = np.argsort(fitness)
        elite_count = int(self.config['pop_size'] * (self.config['elite_percentage'] / 100.0))
        if elite_count < 1:
            elite_count = 1
        elite_population = [self.population[i] for i in sorted_indices[:elite_count]]
        
        new_pop = []
        if self.config.get('elitism', True):
            new_pop.extend(elite_population)
            while len(new_pop) < self.config['pop_size']:
                parent1_idx, parent2_idx = np.random.randint(len(elite_population), size=2)
                parent1 = elite_population[parent1_idx]
                parent2 = elite_population[parent2_idx]
                child = self._reproduce(parent1, parent2)
                new_pop.append(child)
        else:
            while len(new_pop) < self.config['pop_size']:
                parent1_idx, parent2_idx = np.random.randint(len(elite_population), size=2)
                parent1 = elite_population[parent1_idx]
                parent2 = elite_population[parent2_idx]
                child = self._reproduce(parent1, parent2)
                new_pop.append(child)
                
        self.population = new_pop[:self.config['pop_size']]
        self.generation += 1
        new_fitness = np.array([self.calculate_distance(ind) for ind in self.population])
        return self.get_best_route(new_fitness)

    def calculate_distance(self, individual):
        """
        Computes the total distance of the route represented by 'individual'.
        If final_index != start_index, the route is treated as a path (not a cycle),
        meaning the distance from the final destination back to the start is not included.
        """
        perm = individual.tolist()
        # Rotate so that start_index is at the beginning.
        idx = perm.index(self.start_index)
        ordered = perm[idx:] + perm[:idx]
        final_index = self.config.get('final_index', self.start_index)
        if final_index != self.start_index:
            # Ensure the route ends with the final destination.
            if ordered[-1] != final_index:
                j = ordered.index(final_index)
                ordered[j], ordered[-1] = ordered[-1], ordered[j]
            # Compute path distance: from first (start) to last (final), without returning to start.
            route = [self.cities[i] for i in ordered]
        else:
            # If final_index == start_index, treat it as a cycle.
            route = [self.cities[i] for i in ordered] + [self.cities[ordered[0]]]
        distance = 0.0
        for i in range(len(route) - 1):
            distance += np.linalg.norm(route[i+1] - route[i])
        return distance

    def get_best_route(self, fitness):
        """
        Returns the best route (as a 1D list) and its fitness.
        In non-cyclic mode (i.e. if final_index != start_index), the returned route
        is rotated so that the start city is at index 0 and the final city (final_index)
        is at the end.
        """
        best_idx = np.argmin(fitness)
        best_perm = self.population[best_idx].tolist()
        idx = best_perm.index(self.start_index)
        best_route = best_perm[idx:] + best_perm[:idx]
        final_index = self.config.get('final_index', self.start_index)
        # If non-cyclic (final_index different from start), force final element to be final_index.
        if final_index != self.start_index and best_route[-1] != final_index:
            j = best_route.index(final_index)
            best_route[j], best_route[-1] = best_route[-1], best_route[j]
        return {
            'route': best_route,
            'distance': float(fitness[best_idx]),
            'generation': self.generation
        }

    
    def cycle_crossover(self, parent1, parent2):
        parent1 = np.array(parent1).flatten().astype(int)
        parent2 = np.array(parent2).flatten().astype(int)
        cycles = [-1] * len(parent1)
        cycle_num = 1
        idx = 0
        while -1 in cycles:
            if cycles[idx] == -1:
                cycles[idx] = cycle_num
                val = parent2[idx]
                while True:
                    indices = np.where(parent1 == val)[0]
                    if indices.size == 0:
                        raise ValueError("Value not found in parent1: " + str(val))
                    idx = indices[0]
                    if cycles[idx] != -1:
                        break
                    cycles[idx] = cycle_num
                    val = parent2[idx]
                cycle_num += 1
            idx = cycles.index(-1) if -1 in cycles else 0
        child = np.where(np.array(cycles) % 2 == 1, parent1, parent2)
        return child

    def inversion_mutate(self, child):
        if np.random.rand() < self.config['mutation_rate']:
            start, end = sorted(np.random.choice(len(child), 2, replace=False))
            child[start:end] = child[start:end][::-1]
        return child

    def tournament_selection(self, fitness, k=3):
        selected = []
        for _ in range(self.config['pop_size']):
            indices = np.random.choice(len(self.population), k, replace=False)
            winner_idx = indices[np.argmin(fitness[indices])]
            selected.append(self.population[winner_idx])
        return selected

    def roulette_selection(self, fitness):
        inverted_fitness = 1 / (fitness + 1e-8)
        total = inverted_fitness.sum()
        probs = inverted_fitness / total
        return [self.population[np.random.choice(len(self.population), p=probs)] for _ in range(self.config['pop_size'])]
    
    def ox_crossover(self, parent1, parent2):
        size = len(parent1)
        start, end = sorted(np.random.choice(size, 2, replace=False))
        child = np.full(size, -1, dtype=int)
        child[start:end] = parent1[start:end]
        ptr = 0
        for i in list(chain(range(end, size))) + list(range(0, end)):
            if child[i] == -1:
                while parent2[ptr] in child:
                    ptr += 1
                child[i] = parent2[ptr]
                ptr += 1
        return child

    def swap_mutate(self, child):
        if np.random.rand() < self.config['mutation_rate']:
            i, j = np.random.choice(len(child), 2, replace=False)
            child[i], child[j] = child[j], child[i]
        return child

    def single_point_crossover(self, parent1, parent2):
        size = len(parent1)
        cp = np.random.randint(1, size)
        child = np.empty(size, dtype=int)
        child[:cp] = parent1[:cp]
        pos = cp
        for gene in parent2:
            if gene not in child[:cp]:
                child[pos] = gene
                pos += 1
        return child