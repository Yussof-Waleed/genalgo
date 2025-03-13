
from flask import Flask, jsonify, request
from flask_cors import CORS
from genetic import GeneticVRP
import numpy as np

app = Flask(__name__)
CORS(app)

ga = GeneticVRP()

@app.route('/api/configure', methods=['POST'])
def configure():
    data = request.get_json()
    ga.config.update({
        'num_cities': data.get('num_cities', ga.config['num_cities']),
        'pop_size': data.get('pop_size', ga.config['pop_size']),
        'mutation_rate': data.get('mutation_rate', ga.config['mutation_rate']),
        'selection_method': data.get('selection_method', ga.config['selection_method']),
        'crossover_method': data.get('crossover_method', ga.config['crossover_method']),
        'mutation_method': data.get('mutation_method', ga.config['mutation_method']),
        'elite_percentage': data.get('elite_percentage', ga.config.get('elite_percentage', 10)),
        'elitism': data.get('elitism', ga.config.get('elitism', True))
    })
    # Optionally, allow configuration of final destination.
    if 'final' in data:
        ga.config['final_index'] = int(data['final'])
    else:
        ga.config['final_index'] = ga.start_index
    ga.reset()
    return jsonify({"status": "success"}), 200

@app.route('/api/set_cities', methods=['POST'])
def set_custom_cities():
    data = request.get_json()
    # Expect 'cities', 'depot' (start index), and optionally 'final' (final index).
    final = data.get('final', None)
    ga.set_cities(data['cities'], data['depot'], final)
    return jsonify({"status": "success"}), 200

@app.route('/api/cities', methods=['GET'])
def get_cities():
    return jsonify({
        'cities': ga.cities.tolist(),
        'start_index': ga.start_index
    }), 200

@app.route('/api/current_state')
def get_current_state():
    fitness = np.array([ga.calculate_distance(ind) for ind in ga.population])
    best = ga.get_best_route(fitness)
    return jsonify({
        'cities': ga.cities.tolist(),
        'start_index': ga.start_index,
        'generation': ga.generation,
        'best_distance': best['distance']
    })

@app.route('/api/stop', methods=['POST'])
def stop_evolution():
    ga.running = False
    return jsonify({"status": "stopped"}), 200

@app.route('/api/update', methods=['POST'])
def update():
    data = request.get_json()
    try:
        result = ga.evolve(
            mutation_rate=data.get('mutation_rate', 0.02),
            selection_method=data.get('selection_method', 'tournament')
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run()
    # app.run(port=5000, debug=True)
    
